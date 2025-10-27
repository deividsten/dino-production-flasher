"""Helper functions for the DinoCore Production Flasher."""

import winsound
from PIL import Image, ImageTk, ImageDraw, ImageFont
import tkinter as tk


def play_sound(freq, duration):
    """Play a sound with the specified frequency and duration."""
    try:
        winsound.Beep(freq, duration)
    except Exception:
        pass


def create_icon_from_emoji(emoji: str, color: str, size: int = 16):
    """Creates a PhotoImage from an emoji character."""
    try:
        # Create a blank image with transparency
        image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        
        # Try to load a suitable font for emojis
        try:
            font = ImageFont.truetype("seguiemj.ttf", int(size * 0.8))
        except IOError:
            font = ImageFont.load_default()

        # Draw the emoji centered on the image
        draw.text((size/2, size/2), emoji, font=font, anchor="mm", fill=color)
        
        return ImageTk.PhotoImage(image)
    except Exception:
        return None


def parse_version(version_string):
    """Parse a version string into a tuple of integers."""
    try:
        parts = version_string.split('.')
        if len(parts) != 3: 
            return None
        return tuple(map(int, parts))
    except (ValueError, IndexError):
        return None