# DinoCore Production Flasher - Cleaned and Organized

This project is a refactored version of the original gui_flasher.py script, which was a single monolithic file with over 2,600 lines of code. It has been restructured to follow better software engineering practices with clear separation of concerns.

## Directory Structure

```
cleaned_gui_flasher/
├── __init__.py
├── __main__.py
├── ui/                 # User Interface components
│   ├── __init__.py
│   ├── main_app.py     # Main application class
│   ├── log_viewer.py   # Log display component
│   └── dialogs.py      # Dialog windows
├── business_logic/     # Core business logic
│   ├── __init__.py
│   ├── firmware.py     # Firmware handling functions
│   ├── device_detection.py # Device detection and serial communication
│   └── bluetooth_qc.py # Bluetooth Quality Control logic
└── utils/              # Utility functions and configuration
    ├── __init__.py
    ├── config.py       # Configuration constants
    └── helpers.py      # Helper functions
```

## Key Improvements

1. **Single Responsibility Principle**: Each module now has a clear, single purpose
2. **Separation of Concerns**: UI logic, business logic, and utilities are separated
3. **Maintainability**: Code is now much easier to understand, modify, and debug
4. **Testability**: Components can be tested independently

## Running the Application

To run the application, execute the package:

```bash
python -m cleaned_gui_flasher
```

## Components

### UI Layer
- `main_app.py`: Contains the main GUI application class
- `log_viewer.py`: Provides a scrollable text widget for displaying logs
- `dialogs.py`: Contains dialog windows like the version input dialog

### Business Logic Layer
- `firmware.py`: Handles firmware download, flash, and eFuse operations
- `device_detection.py`: Manages device detection, serial communication, and device processing
- `bluetooth_qc.py`: Manages Bluetooth Quality Control operations

### Utilities Layer
- `config.py`: Contains all configuration constants
- `helpers.py`: Contains utility functions like sound playing and icon creation

This structure makes the codebase much more maintainable and easier to extend in the future.

## API Integration

The application includes a dedicated API client module located in `business_logic/api_client.py` that handles communication with the Bondu API at https://bondu.com/toy/wrek2b. The payload includes:
- toy_id: The unique identifier for the toy
- mac_address: The Bluetooth MAC address of the device
- test_data: Various test results and logs

The API client handles error cases gracefully and provides retry functionality when transmission fails.

## Batch Files

The project includes several batch files in the parent directory:
- `run_dino_flasher.bat` - Runs the main application and shows results
- `test_and_run_dino_flasher.bat` - Tests API functionality before running the main application
- `run_api_debug.bat` - Runs API debugging tools to test the payload sending functionality