import os
import math
from PIL import Image, ImageDraw, ImageFilter

def create_app_icon(output_path, size=1024):
    # Create high-res 1024x1024 RGBA canvas
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # macOS squircle background with gradient
    margin = int(size * 0.08)
    corner_radius = int(size * 0.22)
    rect = [margin, margin, size - margin, size - margin]

    # Create gradient background
    grad = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(grad)

    # Linear gradient from rich indigo/blue to cyan/teal
    for y in range(margin, size - margin):
        ratio = (y - margin) / float(size - 2 * margin)
        # Top: Deep Blue (18, 52, 86) -> Mid: Vibrant Azure (26, 115, 232) -> Bottom: Cyan (13, 148, 136)
        if ratio < 0.5:
            sub = ratio / 0.5
            r = int(15 * (1 - sub) + 26 * sub)
            g = int(35 * (1 - sub) + 115 * sub)
            b = int(95 * (1 - sub) + 232 * sub)
        else:
            sub = (ratio - 0.5) / 0.5
            r = int(26 * (1 - sub) + 14 * sub)
            g = int(115 * (1 - sub) + 165 * sub)
            b = int(232 * (1 - sub) + 160 * sub)
        g_draw.line([(margin, y), (size - margin, y)], fill=(r, g, b, 255))

    # Mask with rounded rectangle
    mask = Image.new("L", (size, size), 0)
    m_draw = ImageDraw.Draw(mask)
    m_draw.rounded_rectangle(rect, radius=corner_radius, fill=255)

    # Apply mask
    bg = Image.composite(grad, img, mask)

    # Add subtle border highlight
    d_bg = ImageDraw.Draw(bg)
    d_bg.rounded_rectangle(rect, radius=corner_radius, outline=(255, 255, 255, 45), width=max(2, int(size * 0.005)))

    # Draw Cloud and Server Symbol in center
    cx, cy = size // 2, size // 2 - int(size * 0.02)
    icon_draw = ImageDraw.Draw(bg)

    # Stylized Cloud Shape
    cloud_color = (255, 255, 255, 240)
    # Cloud circles
    c_r1 = int(size * 0.14)
    c_r2 = int(size * 0.18)
    c_r3 = int(size * 0.12)

    # Cloud base pill
    icon_draw.rounded_rectangle(
        [cx - int(size * 0.25), cy - int(size * 0.04), cx + int(size * 0.25), cy + int(size * 0.14)],
        radius=int(size * 0.09),
        fill=cloud_color
    )
    # Left puff
    icon_draw.ellipse(
        [cx - int(size * 0.24) - c_r1, cy + int(size * 0.05) - c_r1, cx - int(size * 0.24) + c_r1, cy + int(size * 0.05) + c_r1],
        fill=cloud_color
    )
    # Center-left puff (highest)
    icon_draw.ellipse(
        [cx - int(size * 0.05) - c_r2, cy - int(size * 0.05) - c_r2, cx - int(size * 0.05) + c_r2, cy - int(size * 0.05) + c_r2],
        fill=cloud_color
    )
    # Right puff
    icon_draw.ellipse(
        [cx + int(size * 0.15) - c_r3, cy + int(size * 0.03) - c_r3, cx + int(size * 0.15) + c_r3, cy + int(size * 0.03) + c_r3],
        fill=cloud_color
    )

    # Server Rack / Terminal Box below cloud
    box_w = int(size * 0.42)
    box_h = int(size * 0.12)
    box_x = cx - box_w // 2
    box_y = cy + int(size * 0.18)

    icon_draw.rounded_rectangle(
        [box_x, box_y, box_x + box_w, box_y + box_h],
        radius=int(size * 0.03),
        fill=(10, 25, 47, 210),
        outline=(255, 255, 255, 70),
        width=int(size * 0.005)
    )

    # Server status LED dots
    led_y = box_y + box_h // 2
    # Green LED (Active)
    led_r = int(size * 0.018)
    icon_draw.ellipse([box_x + int(size * 0.05) - led_r, led_y - led_r, box_x + int(size * 0.05) + led_r, led_y + led_r], fill=(52, 211, 153, 255))
    # Blue LED (Network/Tunnel)
    icon_draw.ellipse([box_x + int(size * 0.10) - led_r, led_y - led_r, box_x + int(size * 0.10) + led_r, led_y + led_r], fill=(96, 165, 250, 255))

    # Server line vents
    vent_start_x = box_x + int(size * 0.18)
    vent_end_x = box_x + box_w - int(size * 0.05)
    icon_draw.line([(vent_start_x, led_y - int(size * 0.015)), (vent_end_x, led_y - int(size * 0.015))], fill=(255, 255, 255, 90), width=int(size * 0.005))
    icon_draw.line([(vent_start_x, led_y + int(size * 0.015)), (vent_end_x, led_y + int(size * 0.015))], fill=(255, 255, 255, 90), width=int(size * 0.005))

    bg.save(output_path, "PNG")
    print(f"Generated app icon at {output_path}")

def create_tray_icon(output_path, size=32):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Simple crisp menu bar cloud icon (monochrome template for macOS menubar)
    cx, cy = size // 2, size // 2
    # Base pill
    draw.rounded_rectangle([cx - 9, cy - 1, cx + 9, cy + 6], radius=4, fill=(255, 255, 255, 255))
    # Puffs
    draw.ellipse([cx - 9, cy - 3, cx - 1, cy + 5], fill=(255, 255, 255, 255))
    draw.ellipse([cx - 4, cy - 8, cx + 5, cy + 1], fill=(255, 255, 255, 255))
    draw.ellipse([cx + 1, cy - 4, cx + 9, cy + 4], fill=(255, 255, 255, 255))
    img.save(output_path, "PNG")
    print(f"Generated tray icon at {output_path}")

if __name__ == "__main__":
    build_dir = os.path.dirname(os.path.abspath(__file__))
    assets_dir = os.path.join(os.path.dirname(build_dir), "assets")
    os.makedirs(build_dir, exist_ok=True)
    os.makedirs(assets_dir, exist_ok=True)

    create_app_icon(os.path.join(build_dir, "icon.png"), 1024)
    create_tray_icon(os.path.join(assets_dir, "trayTemplate.png"), 32)
    create_tray_icon(os.path.join(assets_dir, "trayTemplate@2x.png"), 64)
