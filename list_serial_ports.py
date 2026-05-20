#!/usr/bin/env python3
# list_serial_ports.py
"""List all available serial ports with device description and hardware ID.

Run this script before first hardware connection to identify the COM port
assigned to the WitMotion USB-RS485 adapter.

Expected output on Windows with CH340 adapter:
  Found 1 serial port(s):
    COM3             USB-SERIAL CH340 (COM3)
                     HW: USB VID:PID=1A86:7523 SER=...

If no ports are listed:
  - Windows: check Device Manager -> Ports (COM & LPT)
             if 'USB Serial Device' appears without COM, install WCH CH340
             driver from https://www.wch-ic.com/products/CH340.html
  - Linux: check /dev/ttyUSB* — ensure user is in 'dialout' group
           (sudo usermod -aG dialout $USER)
  - macOS: check /dev/tty.usbserial-* or /dev/tty.wchusbserial*

Usage:
    python list_serial_ports.py
"""
from __future__ import annotations

import sys

import serial.tools.list_ports


def list_ports() -> None:
    """Enumerate and print all available serial ports."""
    ports = list(serial.tools.list_ports.comports())

    if not ports:
        print("No serial ports found.")
        print()
        print("Troubleshooting:")
        print("  Windows: open Device Manager -> Ports (COM & LPT)")
        print("           If 'USB Serial Device' appears without COM number,")
        print("           install WCH CH340 driver: https://www.wch-ic.com/products/CH340.html")
        print("  Linux:   ls /dev/ttyUSB* (ensure dialout group: sudo usermod -aG dialout $USER)")
        print("  macOS:   ls /dev/tty.usbserial-* or ls /dev/tty.wchusbserial*")
        return

    print(f"Found {len(ports)} serial port(s):")
    print()
    for p in sorted(ports, key=lambda x: x.device):
        print(f"  {p.device:<16} {p.description}")
        print(f"  {'':16} HW: {p.hwid}")
        print()


if __name__ == "__main__":
    list_ports()
    sys.exit(0)
