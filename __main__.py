"""Main entry point for the DinoCore Production Flasher."""

import os
import sys
from tkinter import Tk

# Add the parent directory to path to allow imports from the project root
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# Import the main application
from cleaned_gui_flasher.ui.main_app import FlasherApp


def main():
    """Main entry point."""
    # Set working directory to script directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Create the main window
    root = Tk()
    
    # Initialize the application
    app = FlasherApp(root)
    
    # Start the GUI event loop
    root.mainloop()


if __name__ == "__main__":
    main()