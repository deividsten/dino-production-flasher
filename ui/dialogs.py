"""Dialog UI components for the DinoCore Production Flasher."""

import tkinter as tk
from PIL import Image, ImageTk


class VersionDialog:
    """Dialog for entering hardware version."""
    
    def __init__(self, parent, colors):
        self.top = tk.Toplevel(parent)
        self.top.title("Enter Hardware Version")
        self.top.configure(bg=colors['bg'])
        self.top.resizable(False, False)
        self.colors = colors
        self.version = ""

        # Load and display image
        try:
            img_path = "pcb_example.png"
            img = Image.open(img_path)
            img.thumbnail((400, 400))
            self.photo = ImageTk.PhotoImage(img)
            img_label = tk.Label(self.top, image=self.photo, bg=colors['bg'])
            img_label.pack(pady=10, padx=20)
        except (FileNotFoundError, Image.UnidentifiedImageError) as e:
            print(f"Could not load PCB example image: {e}")
            # If image fails to load, show a text placeholder instead of crashing
            tk.Label(self.top, text="Image pcb_example.png not found or is corrupt.", 
                     bg=colors['bg'], fg=colors['warning_btn']).pack(pady=10)

        # Label
        label = tk.Label(self.top, text="Please enter the version number printed on the PCB:", font=("Segoe UI", 12), bg=colors['bg'], fg=colors['text'])
        label.pack(pady=(10, 5), padx=20)

        # Entry
        self.entry = tk.Entry(self.top, font=("Consolas", 14), width=15, bg=colors['entry_bg'], fg=colors['entry_fg'], insertbackground=colors['text'])
        self.entry.pack(pady=10)
        self.entry.focus_set()

        # Button
        button = tk.Button(self.top, text="OK", font=("Segoe UI", 12, "bold"), bg=colors['success_btn'], fg=colors['bg'], command=self.ok)
        button.pack(pady=10, padx=20, fill=tk.X)

        self.top.transient(parent)
        self.top.grab_set()
        self.top.protocol("WM_DELETE_WINDOW", self.cancel)
        self.entry.bind("<Return>", self.ok)

    def ok(self, event=None):
        self.version = self.entry.get()
        self.top.destroy()

    def cancel(self):
        self.version = ""
        self.top.destroy()