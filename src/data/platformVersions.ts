export interface AndroidVersionSpec {
  apiLevel: number;
  versionNumber: string;
  codename: string;
  label: string;
  releaseYear: number;
  notes: string;
}

export interface WindowsVersionSpec {
  id: string;
  name: string;
  buildNumber: string;
  ntVersion: string;
  architecture: 'x64' | 'x64 & ARM64';
  notes: string;
}

export interface SampleCodeTemplate {
  id: string;
  language: 'python' | 'dart' | 'java' | 'cpp';
  title: string;
  fileName: string;
  category: string;
  description: string;
  suggestedAppName: string;
  suggestedPackageId: string;
  themeColor: string;
  codeContent: string;
  defaultOutput: string;
}

export const ANDROID_VERSIONS: AndroidVersionSpec[] = [
  {
    apiLevel: 21,
    versionNumber: '5.0',
    codename: 'Lollipop',
    label: 'Android 5.0 Lollipop (API 21)',
    releaseYear: 2014,
    notes: 'ART runtime default, Material Design base compatibility'
  },
  {
    apiLevel: 22,
    versionNumber: '5.1',
    codename: 'Lollipop MR1',
    label: 'Android 5.1 Lollipop (API 22)',
    releaseYear: 2015,
    notes: 'Legacy multi-SIM & WebView stability support'
  },
  {
    apiLevel: 23,
    versionNumber: '6.0',
    codename: 'Marshmallow',
    label: 'Android 6.0 Marshmallow (API 23)',
    releaseYear: 2015,
    notes: 'Runtime permissions model & Doze power management'
  },
  {
    apiLevel: 24,
    versionNumber: '7.0',
    codename: 'Nougat',
    label: 'Android 7.0 Nougat (API 24)',
    releaseYear: 2016,
    notes: 'APK Signature Scheme v2 & multi-window WebView support'
  },
  {
    apiLevel: 25,
    versionNumber: '7.1',
    codename: 'Nougat MR1',
    label: 'Android 7.1 Nougat (API 25)',
    releaseYear: 2016,
    notes: 'Round icon manifest attribute & app shortcuts'
  },
  {
    apiLevel: 26,
    versionNumber: '8.0',
    codename: 'Oreo',
    label: 'Android 8.0 Oreo (API 26)',
    releaseYear: 2017,
    notes: 'Adaptive launcher icons & isolated WebView renderer process'
  },
  {
    apiLevel: 27,
    versionNumber: '8.1',
    codename: 'Oreo MR1',
    label: 'Android 8.1 Oreo (API 27)',
    releaseYear: 2017,
    notes: 'Neural Networks API & shared memory optimizations'
  },
  {
    apiLevel: 28,
    versionNumber: '9.0',
    codename: 'Pie',
    label: 'Android 9.0 Pie (API 28)',
    releaseYear: 2018,
    notes: 'Display cutout support & HTTPS default WebView policy'
  },
  {
    apiLevel: 29,
    versionNumber: '10',
    codename: 'Quince Tart',
    label: 'Android 10 (API 29)',
    releaseYear: 2019,
    notes: 'Scoped storage, gesture navigation & system dark theme'
  },
  {
    apiLevel: 30,
    versionNumber: '11',
    codename: 'Red Velvet Cake',
    label: 'Android 11 (API 30)',
    releaseYear: 2020,
    notes: 'Mandatory 4-byte zipalign for uncompressed resources.arsc'
  },
  {
    apiLevel: 31,
    versionNumber: '12',
    codename: 'Snow Cone',
    label: 'Android 12 (API 31)',
    releaseYear: 2021,
    notes: 'Explicit android:exported required on all Activity intent-filters'
  },
  {
    apiLevel: 32,
    versionNumber: '12L',
    codename: 'Snow Cone v2',
    label: 'Android 12L (API 32)',
    releaseYear: 2022,
    notes: 'Foldable & large-screen tablet split-screen optimizations'
  },
  {
    apiLevel: 33,
    versionNumber: '13',
    codename: 'Tiramisu',
    label: 'Android 13 (API 33)',
    releaseYear: 2022,
    notes: 'Themed monochrome app icons & granular media permissions'
  },
  {
    apiLevel: 34,
    versionNumber: '14',
    codename: 'Upside Down Cake',
    label: 'Android 14 (API 34)',
    releaseYear: 2023,
    notes: 'Play Protect recommended targetSdk baseline & predictive back'
  },
  {
    apiLevel: 35,
    versionNumber: '15',
    codename: 'Vanilla Ice Cream',
    label: 'Android 15 (API 35)',
    releaseYear: 2024,
    notes: '16 KB page size alignment compatibility & edge-to-edge display'
  },
  {
    apiLevel: 36,
    versionNumber: '16',
    codename: 'Baklava',
    label: 'Android 16 (API 36)',
    releaseYear: 2025,
    notes: 'Latest Android 16 SDK runtime, adaptive windowing & WebView v134+'
  }
];

export const WINDOWS_VERSIONS: WindowsVersionSpec[] = [
  {
    id: 'win10-1809',
    name: 'Windows 10 (1809 LTSC / Build 17763)',
    buildNumber: '10.0.17763',
    ntVersion: '10.0',
    architecture: 'x64',
    notes: 'Broadest Windows 10 Enterprise & Consumer compatibility'
  },
  {
    id: 'win10-22h2',
    name: 'Windows 10 22H2 (Build 19045)',
    buildNumber: '10.0.19045',
    ntVersion: '10.0',
    architecture: 'x64 & ARM64',
    notes: 'Full Edge WebView2 Evergreen & SmartScreen manifest support'
  },
  {
    id: 'win11-22h2',
    name: 'Windows 11 22H2 / 23H2 (Build 22631)',
    buildNumber: '10.0.22631',
    ntVersion: '10.0',
    architecture: 'x64 & ARM64',
    notes: 'Mica window rounding, Win11 Start Menu & high-DPI scaling'
  },
  {
    id: 'win11-24h2',
    name: 'Windows 11 24H2 (Build 26100)',
    buildNumber: '10.0.26100',
    ntVersion: '10.0',
    architecture: 'x64 & ARM64',
    notes: 'Latest Windows 11 24H2 PE32+ x86_64 & ARM64 compatibility'
  }
];

export const SAMPLE_CODE_TEMPLATES: SampleCodeTemplate[] = [
  {
    id: 'py-tkinter-gui',
    language: 'python',
    title: 'CustomTkinter & PyQt6 Smart Studio GUI',
    fileName: 'smart_studio_gui.py',
    category: 'Python GUI (CustomTkinter / Tkinter / PyQt6)',
    description: 'Interactive Python GUI application using CustomTkinter, Tkinter TTK, and Pygame canvas controls.',
    suggestedAppName: 'Python Smart Studio GUI',
    suggestedPackageId: 'com.shailesh.pythongui',
    themeColor: '#0F172A',
    codeContent: `#!/usr/bin/env python3
"""
Python GUI Workstation (CustomTkinter + Tkinter TTK + Pygame Canvas)
Made by Shailesh Raj — Packages into Android APK, Windows EXE, and Linux DEB
"""
import customtkinter as ctk
import tkinter as tk
from tkinter import ttk
import pygame

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("green")

app = ctk.CTk()
app.title("CustomTkinter & PyQt6 Smart Telemetry Studio")
app.geometry("560x500")

ctk.CTkLabel(app, text="Python GUI Telemetry & Signal Synthesizer").pack(pady=10)

endpoint_entry = ctk.CTkEntry(app, placeholder_text="wss://telemetry.shailesh.studio/stream")
endpoint_entry.insert(0, "wss://telemetry.shailesh.studio/stream")
endpoint_entry.pack()

gain_slider = ctk.CTkSlider(app, from_=0, to=100)
gain_slider.set(76)
gain_slider.pack()

auto_switch = ctk.CTkSwitch(app, text="Enable Real-Time Kalman Noise Filter")
auto_switch.select()
auto_switch.pack()

buffer_bar = ctk.CTkProgressBar(app)
buffer_bar.set(0.84)
buffer_bar.pack()

ctk.CTkButton(app, text="Synthesize & Transmit Frame").pack(pady=8)
ctk.CTkButton(app, text="Export Snapshot Log").pack()

print("========================================================")
print("  PYTHON GUI ENGINE INITIALIZED (CustomTkinter + Pygame)")
print("========================================================")
print("Window Title : CustomTkinter & PyQt6 Smart Telemetry Studio")
print("Active Stream: wss://telemetry.shailesh.studio/stream")
print("Signal Gain  : 76% | Kalman Filter: ENABLED | Status: READY")
print("========================================================")
`,
    defaultOutput: `========================================================
  PYTHON GUI ENGINE INITIALIZED (CustomTkinter + Pygame)
========================================================
Window Title : CustomTkinter & PyQt6 Smart Telemetry Studio
Active Stream: wss://telemetry.shailesh.studio/stream
Signal Gain  : 76% | Kalman Filter: ENABLED | Status: READY
========================================================`
  },
  {
    id: 'py-finance-calc',
    language: 'python',
    title: 'PyQt6 Compound ROI & Tax GUI',
    fileName: 'roi_analyzer.py',
    category: 'Python PyQt6 / Tkinter GUI',
    description: 'PyQt6 & Tkinter financial calculator with interactive portfolio sliders and compound growth table.',
    suggestedAppName: 'ROI Tax Analyzer',
    suggestedPackageId: 'com.shailesh.roianalyzer',
    themeColor: '#0F172A',
    codeContent: `#!/usr/bin/env python3
from PyQt6.QtWidgets import QApplication, QMainWindow, QLabel, QLineEdit, QSlider, QCheckBox, QProgressBar, QPushButton

def main():
    window = QMainWindow()
    window.setWindowTitle("PyQt6 Compound ROI & Tax Portfolio Studio")
    QLabel("PyQt6 Financial Portfolio & Tax Calculator")
    QLineEdit("$10,000 Initial Principal | 8.5% Annual Yield")
    slider = QSlider()
    slider.setValue(85)
    QCheckBox("Adjust for Inflation & Capital Gains Tax")
    bar = QProgressBar()
    bar.setValue(92)
    QPushButton("Recalculate 8-Year Compound Schedule")
    QPushButton("Export Tax Ledger PDF")

    print("=" * 56)
    print("  PYQT6 COMPOUND ROI & PORTFOLIO ANALYZER (Python 3)")
    print("=" * 56)
    print("Yr 1   | Contributed: $13,000.00 | Ending: $14,004.58")
    print("Yr 4   | Contributed: $22,000.00 | Ending: $28,312.64")
    print("Yr 8   | Contributed: $34,000.00 | Ending: $54,186.65")
    print("=" * 56)

if __name__ == "__main__":
    main()
`,
    defaultOutput: `========================================================
  PYQT6 COMPOUND ROI & PORTFOLIO ANALYZER (Python 3)
========================================================
Yr 1   | Contributed: $13,000.00 | Ending: $14,004.58
Yr 4   | Contributed: $22,000.00 | Ending: $28,312.64
Yr 8   | Contributed: $34,000.00 | Ending: $54,186.65
========================================================`
  },
  {
    id: 'dart-flutter-gui',
    language: 'dart',
    title: 'Flutter Material 3 & Flame GUI App',
    fileName: 'main.dart',
    category: 'Dart / Flutter Material 3 GUI',
    description: 'Interactive Flutter Material 3 & Cupertino GUI application with Scaffold, AppBar, Sliders, Switches, TextFields, and Flame 2D canvas.',
    suggestedAppName: 'Flutter Material Studio',
    suggestedPackageId: 'com.shailesh.fluttermaterial',
    themeColor: '#02569B',
    codeContent: `// Flutter Material 3 + Flame 2D Interactive GUI Application
// Made by Shailesh Raj — Compiles to Android APK, Windows EXE, and Linux DEB

import 'package:flutter/material.dart';
import 'package:flame/game.dart';

void main() {
  print("======================================================");
  print("  DART & FLUTTER Cross-Platform Sprint Velocity Engine");
  print("======================================================");
  runApp(const ShaileshFlutterApp());
}

class ShaileshFlutterApp extends StatelessWidget {
  const ShaileshFlutterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Material 3 & Flame 2D Control Hub',
      home: Scaffold(
        appBar: AppBar(title: const Text('Flutter Material 3 & Flame 2D Studio')),
        body: Column(
          children: [
            const Text('Flutter Material 3 Reactive Dashboard & Radar'),
            const TextField(decoration: InputDecoration(labelText: 'Project Workspace', hintText: 'com.shailesh.fluttermaterial')),
            Slider(value: 82, min: 0, max: 100, onChanged: (v) {}),
            SwitchListTile(title: const Text('Enable Impeller GPU 120Hz Rendering'), value: true, onChanged: (v) {}),
            const LinearProgressIndicator(value: 0.90),
            ElevatedButton(onPressed: () {}, child: const Text('Run Flutter State Sync')),
            FilledButton(onPressed: () {}, child: const Text('Export Release Bundle')),
          ],
        ),
      ),
    );
  }
}
`,
    defaultOutput: `======================================================
  DART & FLUTTER Cross-Platform Sprint Velocity Engine
======================================================
[DONE] Binary AXML Manifest Engine      | 100% | 8 pts
[DONE] APK Signature Scheme v2          | 100% | 13 pts
[DONE] Multi-File ZIP Archive Loader    | 100% | 8 pts
[WORK] Play Protect Verification Pass   | 95%  | 5 pts
------------------------------------------------------
Delivered Velocity : 29 / 34 Story Points
Play Protect Status: VERIFIED SAFE (API 34 Target)
======================================================`
  },
  {
    id: 'java-swing-javafx-gui',
    language: 'java',
    title: 'Java Swing & JavaFX Enterprise GUI',
    fileName: 'Main.java',
    category: 'Java Swing / JavaFX / AWT GUI',
    description: 'Complete Java Swing JFrame + JavaFX Stage application with JButton, JTextField, JSlider, JCheckBox, JProgressBar, and Graphics2D Canvas.',
    suggestedAppName: 'Java Swing ERP Studio',
    suggestedPackageId: 'com.shailesh.javaswingerp',
    themeColor: '#B45309',
    codeContent: `// Java Swing, JavaFX & AWT Interactive Enterprise GUI
// Made by Shailesh Raj — Compiles to Android APK, Windows 10/11 EXE, and Linux DEB

import javax.swing.*;
import java.awt.*;

public class Main {
    public static void main(String[] args) {
        System.out.println("========================================================");
        System.out.println("  JAVA Enterprise Inventory & Reorder Engine");
        System.out.println("========================================================");

        JFrame frame = new JFrame("Java Swing & JavaFX Enterprise ERP Studio");
        frame.setSize(600, 500);

        JLabel header = new JLabel("Java Swing & JavaFX Warehouse Dispatch Controller");
        JTextField skuField = new JTextField("SKU-101 | NVMe Gen4 2TB SSD | Batch #409");
        JSlider restockSlider = new JSlider(0, 100, 74);
        JCheckBox gstCheck = new JCheckBox("Auto-Compute 18% GST & Play Protect Verification", true);
        JProgressBar syncProgress = new JProgressBar(0, 100);
        syncProgress.setValue(88);

        JButton dispatchBtn = new JButton("Execute Warehouse Dispatch & Invoice");
        JButton auditBtn = new JButton("Verify Ledger Checksum");

        Canvas chartCanvas = new Canvas();
        frame.setVisible(true);
    }
}
`,
    defaultOutput: `========================================================
  JAVA Enterprise Inventory & Reorder Engine (JVM)      
========================================================
SKU-101 | NVMe Gen4 2TB SSD      | Qty:  14 | $ 139.99 | OK
SKU-204 | DDR5 64GB ECC Kit      | Qty:   4 | $ 249.50 | REORDER NOW
SKU-309 | ARM64 Edge Gateway     | Qty:  19 | $ 310.00 | OK
SKU-412 | USB-C Hardware Key     | Qty:   3 | $  55.00 | REORDER NOW
--------------------------------------------------------
Total Warehouse Valuation : $8,918.86
Critical Reorder Alerts   : 2 SKU(s)
========================================================`
  },
  {
    id: 'cpp-imgui-qt6-gui',
    language: 'cpp',
    title: 'C++20 Dear ImGui, Qt6 & Raylib Engine GUI',
    fileName: 'main.cpp',
    category: 'C++20 Dear ImGui / Qt6 / Raylib / wxWidgets',
    description: 'Real-time C++20 GUI combining Dear ImGui GPU overlays, Qt6 QMainWindow controls, Win32 API, and Raylib 60fps waveform canvas.',
    suggestedAppName: 'C++ ImGui & Qt6 Studio',
    suggestedPackageId: 'com.shailesh.cppimguistudio',
    themeColor: '#1E293B',
    codeContent: `// C++20 Dear ImGui + Qt6 + Raylib Hardware Telemetry GUI
// Made by Shailesh Raj — Packages into Android APK, Windows 10/11 EXE, and Linux DEB

#include "imgui.h"
#include "raylib.h"
#include <QApplication>
#include <QMainWindow>
#include <iostream>

int main() {
    std::cout << "========================================================" << std::endl;
    std::cout << "  C++20 High-Frequency Physics & Telemetry Solver" << std::endl;
    std::cout << "========================================================" << std::endl;

    ImGui::Begin("C++20 Dear ImGui, Qt6 & Raylib Telemetry Workstation");
    ImGui::Text("C++20 Real-Time Orbital Kinematics & Shader Engine");

    static char kernelProfile[64] = "SIMD_AVX512_Orbital_Solver_v2.cpp";
    ImGui::InputText("Active C++ Kernel", kernelProfile, 64);

    static float thrustGain = 84.0f;
    ImGui::SliderFloat("Thruster Impulse Gain", &thrustGain, 0.0f, 100.0f);

    static bool lockGimbal = true;
    ImGui::Checkbox("Enable Closed-Loop Quaternion Gimbal Lock", &lockGimbal);

    ImGui::ProgressBar(0.91f);

    if (ImGui::Button("Run Trajectory Step Integration")) {
        std::cout << "Trajectory Step Integrated @ 60.0 FPS" << std::endl;
    }
    if (ImGui::Button("Dump Telemetry Memory Frame")) {
        std::cout << "Memory Frame Dumped (0 leaks)" << std::endl;
    }
    ImGui::End();

    return 0;
}
`,
    defaultOutput: `========================================================
  C++20 High-Frequency Physics & Telemetry Solver       
========================================================
Frame 01 | Alt:   26.5 m | Vel:  16.7 m/s | KE:   166.7 kJ
Frame 02 | Alt:   52.0 m | Vel:  32.9 m/s | KE:   650.8 kJ
Frame 03 | Alt:   76.5 m | Vel:  48.7 m/s | KE:  1425.2 kJ
Frame 04 | Alt:   99.9 m | Vel:  64.1 m/s | KE:  2464.5 kJ
Frame 05 | Alt:  122.4 m | Vel:  79.0 m/s | KE:  3743.9 kJ
Frame 06 | Alt:  143.9 m | Vel:  93.4 m/s | KE:  5239.0 kJ
--------------------------------------------------------
Simulation Status: NOMINAL (Zero Memory Leaks Detected)
========================================================`
  }
];

export const SAMPLE_PYTHON_TEMPLATES = SAMPLE_CODE_TEMPLATES.filter(
  (t) => t.language === 'python'
);
