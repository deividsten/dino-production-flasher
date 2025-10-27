"""Log viewer UI component for the DinoCore Production Flasher."""

import tkinter as tk


class LogViewer(tk.Frame):
    """A scrollable text widget for displaying logs."""
    
    def __init__(self, parent, colors, icons, *args, **kwargs):
        super().__init__(parent, bg=colors['log_bg'], *args, **kwargs)
        self.colors = colors
        self.icons = icons

        # Use a Text widget for selectable text
        self.text_widget = tk.Text(self, bg=colors['log_bg'], fg=colors['log_text'],
                                  font=("Consolas", 10), wrap=tk.WORD,
                                  state=tk.NORMAL,  # Allow selection but we'll make it read-only
                                  selectbackground=colors['highlight'],
                                  selectforeground=colors['bg'],
                                  insertbackground=colors['text'])
        self.text_widget.pack(side="left", fill="both", expand=True)

        # Make it read-only but selectable
        self.text_widget.bind("<Key>", lambda e: "break")  # Disable keyboard input
        self.text_widget.bind("<Button-1>", self._allow_select)  # Allow mouse selection

        self.scrollbar = tk.Scrollbar(self, orient="vertical", command=self.text_widget.yview)
        self.scrollbar.pack(side="right", fill="y")
        self.text_widget.configure(yscrollcommand=self.scrollbar.set)

        # Configure tags for different message types
        self.text_widget.tag_configure("success", foreground=colors['success_btn'])
        self.text_widget.tag_configure("error", foreground=colors['prod_btn'])
        self.text_widget.tag_configure("warning", foreground=colors['warning_btn'])
        self.text_widget.tag_configure("info", foreground=colors['log_text'])
        self.text_widget.tag_configure("bt", foreground=colors['highlight'])
        self.text_widget.tag_configure("firebase", foreground="#f5a97f")
        self.text_widget.tag_configure("flash", foreground="#f9e2af")

        # Track the last progress line for updates
        self.last_progress_line = None
        self.last_any_line = None  # Track any line separately

    def _allow_select(self, event):
        """Allow text selection but prevent editing"""
        # Allow normal selection behavior
        return None

    def add_log_entry(self, message, icon=None, tag="info"):
        """Add a new log entry to the text widget"""
        # Insert the message
        start_pos = self.text_widget.index("end-1c")
        self.text_widget.insert(tk.END, message.strip() + "\n", tag)
        end_pos = self.text_widget.index("end-1c")

        # Auto-scroll to the bottom
        self.text_widget.see(tk.END)

        # Store reference for potential progress updates (this tracks any line, not just progress)
        self.last_any_line = (start_pos, end_pos)

    def update_last_line(self, message):
        """Update the last line (used for progress updates)"""
        if self.last_any_line:  # Use the most recent line for updates
            start_pos, end_pos = self.last_any_line
            # Remove the old content
            self.text_widget.delete(start_pos, end_pos)
            # Insert the new content
            self.text_widget.insert(start_pos, message.strip() + "\n", "flash")
            # Update the stored position
            new_end_pos = self.text_widget.index(f"{start_pos} + {len(message.strip()) + 1}c")
            self.last_any_line = (start_pos, new_end_pos)  # Update the last line reference
            # Auto-scroll to the bottom
            self.text_widget.see(tk.END)
        else:
            # If no last line, just add a new one
            self.add_log_entry(message, tag="flash")