import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { ZipArchive } from 'archiver';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { isPathAllowedForUser } from './fileManager.js';
import { recordDownloadActivity } from './notificationManager.js';

// Cache probe results: filePath -> { needsTranscode, audioCodec, videoCodec, checkedAt }
const probeCache = new Map();

function probeMediaFile(filePath) {
  return new Promise((resolve) => {
    if (!ffmpegPath) {
      return resolve({ needsTranscode: false, audioCodec: null });
    }
    const cached = probeCache.get(filePath);
    if (cached && (Date.now() - cached.checkedAt < 60000)) {
      return resolve(cached);
    }

    const ff = spawn(ffmpegPath, ['-i', filePath]);
    let stderr = '';
    ff.stderr.on('data', (d) => { stderr += d.toString(); });
    ff.on('close', () => {
      const audioMatch = stderr.match(/Audio: ([^,\n]+)/);
      const videoMatch = stderr.match(/Video: ([^,\n]+)/);
      const audioCodec = audioMatch ? audioMatch[1].trim().toLowerCase() : '';
      const videoCodec = videoMatch ? videoMatch[1].trim().toLowerCase() : '';

      const ext = path.extname(filePath).toLowerCase();
      // Browser-unfriendly containers or audio codecs (eac3, ac3, dts, truehd, 5.1 non-stereo, etc.)
      const isUnfriendlyContainer = ['.mkv', '.avi', '.wmv', '.flv', '.ts', '.m2ts', '.vob'].includes(ext);
      const isUnfriendlyAudio = /ac-?3|eac-?3|dts|truehd|mlp|pcm_s/i.test(audioCodec);
      const isMultiChannel = /5\.1|7\.1/i.test(audioCodec);

      const needsTranscode = isUnfriendlyContainer || isUnfriendlyAudio || isMultiChannel;

      const res = { needsTranscode, audioCodec, videoCodec, checkedAt: Date.now() };
      probeCache.set(filePath, res);
      resolve(res);
    });
    ff.on('error', () => {
      resolve({ needsTranscode: false, audioCodec: null });
    });
  });
}

export async function handleFileDownload(req, res) {
  const targetPath = path.resolve(req.query.path);

  if (!isPathAllowedForUser(targetPath, req.user)) {
    return res.status(403).json({ success: false, error: 'Access denied. You do not have permission to download this item.' });
  }

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ success: false, error: 'File not found' });
  }

  const stat = await fs.promises.stat(targetPath);

  // If it's a directory, zip and stream
  if (stat.isDirectory()) {
    const folderName = path.basename(targetPath) || 'folder';
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(folderName)}.zip"`);

    // Record download event for folder zip
    recordDownloadActivity({
      user: req.user,
      filePath: targetPath,
      fileName: `${folderName}.zip`,
      fileSize: 0,
      isDirectory: true
    });

    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).send('Error creating zip archive');
      }
    });

    archive.pipe(res);
    archive.directory(targetPath, folderName);
    await archive.finalize();
    return;
  }

  // Single file download
  const filename = path.basename(targetPath);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.setHeader('Content-Type', mime.lookup(targetPath) || 'application/octet-stream');
  res.setHeader('Content-Length', stat.size);

  // Record download activity for admin notification
  recordDownloadActivity({
    user: req.user,
    filePath: targetPath,
    fileName: filename,
    fileSize: stat.size,
    isDirectory: false
  });

  const stream = fs.createReadStream(targetPath);
  stream.pipe(res);
}

export async function handleFileStream(req, res) {
  const targetPath = path.resolve(req.query.path);

  if (!isPathAllowedForUser(targetPath, req.user)) {
    return res.status(403).send('Access denied');
  }

  if (!fs.existsSync(targetPath)) {
    return res.status(404).send('File not found');
  }

  const stat = await fs.promises.stat(targetPath);
  if (stat.isDirectory()) {
    return res.status(400).send('Cannot stream a directory');
  }

  const fileSize = stat.size;
  const mimeType = (mime.lookup(targetPath) || 'application/octet-stream').toLowerCase();
  const isVideo = mimeType.startsWith('video/') || ['.mkv', '.avi', '.wmv', '.flv', '.ts', '.mp4', '.mov', '.webm', '.m4v'].includes(path.extname(targetPath).toLowerCase());

  // Check if real-time audio transmuxing is required
  let shouldTranscode = req.query.transcode === '1';
  if (!shouldTranscode && isVideo) {
    const probe = await probeMediaFile(targetPath);
    shouldTranscode = probe.needsTranscode;
  }

  // Real-time video copy + audio AAC stereo transmuxing using ffmpeg
  if (shouldTranscode && ffmpegPath) {
    const startTime = parseFloat(req.query.t || req.query.start || '0') || 0;

    const ffmpegArgs = [];
    if (startTime > 0) {
      ffmpegArgs.push('-ss', String(startTime));
    }
    ffmpegArgs.push(
      '-i', targetPath,
      '-map', '0:v:0',
      '-map', '0:a:0?',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-ac', '2',
      '-b:a', '192k',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      '-f', 'mp4',
      'pipe:1'
    );

    const ff = spawn(ffmpegPath, ffmpegArgs);

    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Connection': 'keep-alive'
    });

    ff.stdout.pipe(res);

    ff.stderr.on('data', () => {}); // Consume stderr to prevent pipe backpressure

    const killProcess = () => {
      try {
        ff.kill('SIGKILL');
      } catch (e) {}
    };

    res.on('close', killProcess);
    res.on('finish', killProcess);
    ff.on('error', () => {
      if (!res.headersSent) res.status(500).send('Transcoding error');
    });
    return;
  }

  // Standard range streaming for browser-native audio and formats
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.status(416).send('Requested range not satisfiable');
    }

    const chunksize = end - start + 1;
    const file = fs.createReadStream(targetPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': mimeType
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes'
    };
    res.writeHead(200, head);
    fs.createReadStream(targetPath).pipe(res);
  }
}
