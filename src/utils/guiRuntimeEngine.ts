import { SourceLanguage } from './multiPlatformBuilder';

export interface GuiLibraryModuleSpec {
  id: string;
  language: SourceLanguage;
  name: string;
  importStatement: string;
  version: string;
  frameworkStyle:
    | 'tk'
    | 'ctk'
    | 'qt'
    | 'kivy'
    | 'flutter-material'
    | 'flutter-cupertino'
    | 'swing'
    | 'javafx'
    | 'android-ui'
    | 'imgui'
    | 'wx'
    | 'win32'
    | 'raylib';
  description: string;
  widgetsProvided: string[];
  snippetCode: string;
}

export interface ExtractedGuiWidget {
  id: string;
  type:
    | 'header'
    | 'label'
    | 'button'
    | 'input'
    | 'slider'
    | 'switch'
    | 'progress'
    | 'select'
    | 'table'
    | 'canvas'
    | 'metric';
  label: string;
  value?: string | number | boolean;
  defaultValue?: string | number | boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: string[];
  tableHeaders?: string[];
  tableRows?: string[][];
  fgColor?: string;
  bgColor?: string;
  width?: number;
  height?: number;
}

export interface CanvasDrawCommand {
  op: 'clear' | 'rect' | 'ellipse' | 'line' | 'polygon' | 'text';
  color?: string;
  fill?: string;
  stroke?: string;
  width?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  points?: number[];
  text?: string;
}

export interface GuiDialogMessage {
  type: 'info' | 'warning' | 'error' | 'question';
  title: string;
  message: string;
}

export interface ParsedGuiApplication {
  hasGui: boolean;
  detectedFrameworkId: string;
  detectedFrameworkName: string;
  frameworkStyle: GuiLibraryModuleSpec['frameworkStyle'];
  windowTitle: string;
  windowWidth: number;
  windowHeight: number;
  accentColor: string;
  darkMode: boolean;
  importedModules: string[];
  widgets: ExtractedGuiWidget[];
  dialogs?: GuiDialogMessage[];
  canvasCommands?: CanvasDrawCommand[];
  canvasWidth?: number;
  canvasHeight?: number;
}

/**
 * Comprehensive registry of all GUI modules and libraries for Python (12 frameworks), Dart, Java, and C++.
 */
export const GUI_MODULES_REGISTRY: GuiLibraryModuleSpec[] = [
  // ================= PYTHON GUI MODULES (ALL 12 FRAMEWORKS) =================
  {
    id: 'py-tkinter',
    language: 'python',
    name: 'Tkinter & TTK (Standard Python GUI + Canvas)',
    importStatement: 'import tkinter as tk\nfrom tkinter import ttk, messagebox',
    version: 'Tk 8.6 / Python 3',
    frameworkStyle: 'tk',
    description:
      'Real Python Tkinter & TTK execution with StringVar/DoubleVar binding, Entry, Scale, Checkbutton, Combobox, Canvas 2D drawing, and messagebox callbacks.',
    widgetsProvided: [
      'Tk',
      'Frame',
      'Label',
      'Button',
      'Entry',
      'Scale',
      'Checkbutton',
      'Combobox',
      'Progressbar',
      'Treeview',
      'Canvas',
      'messagebox'
    ],
    snippetCode: `import tkinter as tk
from tkinter import ttk, messagebox

root = tk.Tk()
root.title("Tkinter & TTK Smart Telemetry & Canvas Studio")
root.geometry("540x480")

status_var = tk.StringVar(value="Status: Ready — Adjust controls and click Calculate")
ttk.Label(root, textvariable=status_var).pack(pady=6)

host_entry = ttk.Entry(root)
host_entry.insert(0, "192.168.1.104:8080")
host_entry.pack()

mode_combo = ttk.Combobox(root, values=["Balanced Mode", "Turbo Boost Mode", "Low-Power Eco Mode"])
mode_combo.set("Turbo Boost Mode")
mode_combo.pack()

gain_slider = ttk.Scale(root, from_=0, to=100, value=75)
gain_slider.pack()

auto_sync = ttk.Checkbutton(root, text="Enable Real-Time Sensor Auto-Calibration", value=True)
auto_sync.pack()

progress = ttk.Progressbar(root, value=78, maximum=100)
progress.pack()

canvas = tk.Canvas(root, width=480, height=150, bg="#0B1120")
canvas.create_rectangle(20, 20, 460, 130, outline="#334155", width=1.5)
canvas.create_oval(45, 40, 115, 110, fill="#10B981", outline="#A7F3D0", width=2)
canvas.create_line(140, 105, 210, 45, 280, 95, 360, 35, 435, 75, fill="#38BDF8", width=3)
canvas.create_text(145, 28, text="Tkinter Live Vector Telemetry Surface", fill="#E2E8F0")
canvas.pack(pady=6)

def run_diagnostics():
    host = host_entry.get()
    gain = float(gain_slider.get())
    mode = mode_combo.get()
    power_mw = round(gain * 14.8, 1)
    status_var.set(f"Verified {host} [{mode}] -> Output: {power_mw} mW")
    progress.set(min(100, gain))
    print(f"[Tkinter Callback] Host={host} | Mode={mode} | Gain={gain}% | Power={power_mw}mW")
    messagebox.showinfo("Tkinter Diagnostics", f"Connected to {host}\\nMode: {mode}\\nCalculated Output: {power_mw} mW")

ttk.Button(root, text="Run Diagnostics & Calculate", command=run_diagnostics).pack(pady=6)
root.mainloop()`
  },
  {
    id: 'py-customtkinter',
    language: 'python',
    name: 'CustomTkinter (Modern Dark/Light UI)',
    importStatement: 'import customtkinter as ctk',
    version: 'CustomTkinter 5.2.2',
    frameworkStyle: 'ctk',
    description:
      'Real CustomTkinter execution with CTk, CTkLabel, CTkEntry, CTkSlider, CTkSwitch, CTkOptionMenu, CTkProgressBar, and live Python callbacks.',
    widgetsProvided: [
      'CTk',
      'CTkFrame',
      'CTkLabel',
      'CTkButton',
      'CTkEntry',
      'CTkSlider',
      'CTkSwitch',
      'CTkProgressBar',
      'CTkOptionMenu',
      'CTkComboBox'
    ],
    snippetCode: `import customtkinter as ctk

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("green")

app = ctk.CTk()
app.title("CustomTkinter AI & Neural Compute Workstation")
app.geometry("540x480")

result_label = ctk.CTkLabel(app, text="CustomTkinter Neural Compute Cluster: Standby")
result_label.pack(pady=8)

endpoint_entry = ctk.CTkEntry(app, placeholder_text="Cluster Endpoint URL")
endpoint_entry.insert(0, "https://compute.shailesh.studio/v1/train")
endpoint_entry.pack()

model_menu = ctk.CTkOptionMenu(app, values=["Transformer-XL-7B", "Vision-ViT-Large", "Audio-WaveNet-v3"])
model_menu.set("Transformer-XL-7B")
model_menu.pack()

batch_slider = ctk.CTkSlider(app, from_=8, to=256)
batch_slider.set(64)
batch_slider.pack()

fp16_switch = ctk.CTkSwitch(app, text="Enable FP16 Tensor Core Acceleration")
fp16_switch.select()
fp16_switch.pack()

gpu_bar = ctk.CTkProgressBar(app)
gpu_bar.set(0.82)
gpu_bar.pack()

def launch_training():
    ep = endpoint_entry.get()
    mdl = model_menu.get()
    batch = int(float(batch_slider.get()))
    fp16 = bool(fp16_switch.get())
    tflops = round(batch * (2.4 if fp16 else 1.1), 1)
    result_label.configure(text=f"Training {mdl} (Batch {batch}) -> {tflops} TFLOPS")
    gpu_bar.set(min(100, max(15, int(batch / 2.56))))
    print(f"[CustomTkinter] Endpoint: {ep} | Model: {mdl} | Batch: {batch} | FP16: {fp16} -> {tflops} TFLOPS")

ctk.CTkButton(app, text="Launch Neural Training Job", command=launch_training).pack(pady=8)
app.mainloop()`
  },
  {
    id: 'py-kivymd',
    language: 'python',
    name: 'Kivy & KivyMD (Android Touch & Material UI)',
    importStatement:
      'from kivymd.app import MDApp\nfrom kivymd.uix.screen import MDScreen\nfrom kivymd.uix.button import MDRaisedButton\nfrom kivymd.uix.textfield import MDTextField\nfrom kivymd.uix.slider import MDSlider',
    version: 'Kivy 2.3.0 / KivyMD 1.2',
    frameworkStyle: 'kivy',
    description:
      'Real Kivy & KivyMD mobile touch execution with MDApp, MDScreen, MDLabel, MDTextField, MDSlider, MDSwitch, and MDRaisedButton event bindings.',
    widgetsProvided: [
      'App',
      'MDApp',
      'MDScreen',
      'MDBoxLayout',
      'MDLabel',
      'MDRaisedButton',
      'MDTextField',
      'MDSlider',
      'MDSwitch',
      'MDProgressBar'
    ],
    snippetCode: `from kivymd.app import MDApp
from kivymd.uix.screen import MDScreen
from kivymd.uix.label import MDLabel
from kivymd.uix.button import MDRaisedButton
from kivymd.uix.textfield import MDTextField
from kivymd.uix.slider import MDSlider
from kivymd.uix.selectioncontrol import MDSwitch

class SmartHomeKivyApp(MDApp):
    def build(self):
        self.title = "KivyMD Android Smart Climate & Security Hub"
        screen = MDScreen()

        self.status_lbl = MDLabel(text="KivyMD Zone Status: 23.0°C Optimal Climate")
        self.zone_field = MDTextField(text="Living Room & Home Theater")
        self.temp_slider = MDSlider(min=16, max=32, value=23)
        self.eco_switch = MDSwitch(text="Enable AI Occupancy Power Saver", active=True)

        def apply_preset(instance=None):
            zone = self.zone_field.text
            temp = round(float(self.temp_slider.value), 1)
            eco = "ECO-ON" if self.eco_switch.active else "MAX-COOL"
            self.status_lbl.text = f"[{zone}] Set to {temp}°C ({eco})"
            print(f"[KivyMD Touch Event] Zone='{zone}' | Target={temp}C | Mode={eco}")

        btn = MDRaisedButton(text="Apply KivyMD Climate Preset", on_release=apply_preset)
        return screen

SmartHomeKivyApp().run()`
  },
  {
    id: 'py-pygame',
    language: 'python',
    name: 'Pygame (2D Game Loop, Sprites & Vector Surface)',
    importStatement: 'import pygame\nimport math',
    version: 'Pygame 2.6.0 (SDL2)',
    frameworkStyle: 'flutter-material',
    description:
      'Real Pygame script execution capturing pygame.display, Surface.fill, pygame.draw (circle, rect, line, polygon, ellipse), and font rendering onto the interactive canvas.',
    widgetsProvided: [
      'pygame.init',
      'pygame.display.set_mode',
      'pygame.Surface',
      'pygame.Rect',
      'pygame.draw.circle',
      'pygame.draw.rect',
      'pygame.draw.line',
      'pygame.draw.polygon',
      'pygame.font.SysFont',
      'pygame.time.Clock'
    ],
    snippetCode: `import pygame
import math

pygame.init()
screen = pygame.display.set_mode((500, 240))
pygame.display.set_caption("Pygame 2D Orbital Physics & Radar Engine")
clock = pygame.time.Clock()
font = pygame.font.SysFont("monospace", 14)

running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

    screen.fill((7, 11, 20))

    # Draw radar grid & concentric orbital rings
    pygame.draw.rect(screen, (30, 41, 59), (12, 12, 476, 216), 2)
    pygame.draw.circle(screen, (16, 185, 129), (140, 120), 75, 2)
    pygame.draw.circle(screen, (56, 189, 248), (140, 120), 45, 1)
    pygame.draw.circle(screen, (245, 158, 11), (140, 120), 14, 0)

    # Orbiting satellite & vector trajectory
    sat_x = 140 + int(75 * math.cos(0.85))
    sat_y = 120 + int(75 * math.sin(0.85))
    pygame.draw.line(screen, (16, 185, 129), (140, 120), (sat_x, sat_y), 2)
    pygame.draw.circle(screen, (52, 211, 153), (sat_x, sat_y), 7, 0)

    # Telemetry bar chart on right side
    bars = [65, 92, 48, 84, 73]
    for i, val in enumerate(bars):
        bx = 270 + i * 38
        bh = int(val * 1.4)
        pygame.draw.rect(screen, (56, 189, 248), (bx, 200 - bh, 24, bh), 0)

    hud = font.render("PYGAME SDL2 SURFACE | ORBITAL VELOCITY: 7.66 KM/S", True, (167, 243, 208))
    screen.blit(hud, (24, 22))
    pygame.display.flip()
    clock.tick(60)

print("[Pygame Engine] Rendered 2D orbital radar & telemetry bars (60 FPS SDL2)")
pygame.quit()`
  },
  {
    id: 'py-pyqt6',
    language: 'python',
    name: 'PyQt6 / PySide6 (Qt6 C++ Python Bindings)',
    importStatement:
      'from PyQt6.QtWidgets import QApplication, QMainWindow, QLabel, QPushButton, QLineEdit, QSlider, QCheckBox, QComboBox, QProgressBar, QMessageBox',
    version: 'PyQt 6.7 / PySide 6.7',
    frameworkStyle: 'qt',
    description:
      'Real PyQt6, PyQt5, PySide6 & PySide2 widget execution with Signals/Slots (.clicked.connect), QMainWindow, QLineEdit, QSlider, QComboBox, and QMessageBox.',
    widgetsProvided: [
      'QApplication',
      'QMainWindow',
      'QLabel',
      'QPushButton',
      'QLineEdit',
      'QSlider',
      'QSpinBox',
      'QCheckBox',
      'QComboBox',
      'QProgressBar',
      'QMessageBox'
    ],
    snippetCode: `import sys
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QLabel, QPushButton,
    QLineEdit, QSlider, QCheckBox, QComboBox, QProgressBar, QMessageBox
)

app = QApplication(sys.argv)
window = QMainWindow()
window.setWindowTitle("PyQt6 Enterprise SQL Cluster & Replication Studio")
window.resize(560, 480)

status_lbl = QLabel("PyQt6 Cluster Status: PRIMARY ONLINE (0 ms replication lag)")
query_input = QLineEdit("SELECT sku, stock, price FROM warehouse WHERE active = 1;")

region_combo = QComboBox()
region_combo.addItems(["ap-south-1 (Mumbai)", "us-east-1 (Virginia)", "eu-central-1 (Frankfurt)"])

pool_slider = QSlider()
pool_slider.setRange(4, 128)
pool_slider.setValue(48)

ssl_check = QCheckBox("Enforce TLS 1.3 Strict Certificate Verification")
ssl_check.setChecked(True)

health_bar = QProgressBar()
health_bar.setValue(92)

def execute_sql():
    q = query_input.text()
    reg = region_combo.currentText()
    conns = pool_slider.value()
    status_lbl.setText(f"[{reg}] Executed on {conns} workers: {q[:36]}...")
    print(f"[PyQt6 Slot] Region={reg} | Pool={conns} | TLS={ssl_check.isChecked()} | SQL={q}")
    QMessageBox.information(window, "PyQt6 Query Executed", f"Region: {reg}\\nWorker Pool: {conns} threads\\nQuery: {q}")

btn_exec = QPushButton("Execute SQL Query on Cluster")
btn_exec.clicked.connect(execute_sql)

window.show()
app.exec()`
  },
  {
    id: 'py-wxpython',
    language: 'python',
    name: 'wxPython (`import wx` Native Desktop Toolkit)',
    importStatement: 'import wx',
    version: 'wxPython 4.2.1',
    frameworkStyle: 'wx',
    description:
      'Real wxPython native GUI execution with wx.App, wx.Frame, wx.Panel, wx.StaticText, wx.TextCtrl, wx.Slider, wx.CheckBox, wx.Choice, wx.Gauge, and wx.EVT_BUTTON bindings.',
    widgetsProvided: [
      'wx.App',
      'wx.Frame',
      'wx.Panel',
      'wx.StaticText',
      'wx.Button',
      'wx.TextCtrl',
      'wx.Slider',
      'wx.CheckBox',
      'wx.Choice',
      'wx.Gauge',
      'wx.MessageBox'
    ],
    snippetCode: `import wx

app = wx.App()
frame = wx.Frame(None, title="wxPython Hardware Serial & Firmware Flasher", size=(560, 450))
panel = wx.Panel(frame)

header = wx.StaticText(panel, label="wxPython UART / USB-C Firmware Programming Utility")
port_input = wx.TextCtrl(panel, value="/dev/ttyUSB0 @ 115200 baud")
chip_choice = wx.Choice(panel, choices=["ESP32-S3 Dual-Core", "STM32H743 ARM Cortex-M7", "RP2040 Dual M0+"])
baud_slider = wx.Slider(panel, value=85, minValue=10, maxValue=100)
verify_chk = wx.CheckBox(panel, label="Verify CRC-32 & SHA-256 Checksum After Flash")
progress = wx.Gauge(panel, range=100)

def on_flash_firmware(event):
    port = port_input.GetValue()
    chip = chip_choice.GetValue()
    speed = baud_slider.GetValue()
    header.SetLabel(f"Flashed {chip} on {port} ({speed}% speed) - VERIFIED OK")
    progress.SetValue(100)
    print(f"[wxPython EVT_BUTTON] Chip={chip} | Port={port} | Speed={speed}%")
    wx.MessageBox(f"Firmware flashed to {chip} via {port}", "wxPython Flash Complete")

flash_btn = wx.Button(panel, label="Flash & Verify Firmware Binary")
flash_btn.Bind(wx.EVT_BUTTON, on_flash_firmware)

frame.Show()
app.MainLoop()`
  },
  {
    id: 'py-flet',
    language: 'python',
    name: 'Flet (`import flet as ft` — Flutter for Python)',
    importStatement: 'import flet as ft',
    version: 'Flet 0.24.1',
    frameworkStyle: 'flutter-material',
    description:
      'Real Flet reactive Python UI execution with ft.Page, ft.Text, ft.TextField, ft.Slider, ft.Switch, ft.Dropdown, ft.ProgressBar, and ft.ElevatedButton callbacks.',
    widgetsProvided: [
      'ft.Page',
      'ft.AppBar',
      'ft.Text',
      'ft.ElevatedButton',
      'ft.FilledButton',
      'ft.TextField',
      'ft.Slider',
      'ft.Switch',
      'ft.Dropdown',
      'ft.ProgressBar'
    ],
    snippetCode: `import flet as ft

def main(page: ft.Page):
    page.title = "Flet Cloud Microservice & API Gateway"

    status_text = ft.Text(value="Flet Gateway Ready — Configure rate limits below")
    route_input = ft.TextField(label="API Route Prefix", value="/api/v2/payments")
    rate_slider = ft.Slider(label="Rate Limit (req/sec)", min=10, max=500, value=180)
    jwt_switch = ft.Switch(label="Enforce OAuth2 / JWT Bearer Validation", value=True)
    load_bar = ft.ProgressBar(value=0.72)

    def deploy_gateway(e):
        route = route_input.value
        rate = int(float(rate_slider.value))
        auth = "JWT-STRICT" if jwt_switch.value else "PUBLIC"
        status_text.value = f"Deployed {route} @ {rate} req/s [{auth}]"
        page.update()
        print(f"[Flet Event] Route={route} | RateLimit={rate} rps | Auth={auth}")

    deploy_btn = ft.ElevatedButton(text="Deploy Flet API Gateway Policy", on_click=deploy_gateway)
    page.add(status_text, route_input, rate_slider, jwt_switch, load_bar, deploy_btn)

ft.app(target=main)`
  },
  {
    id: 'py-pysimplegui',
    language: 'python',
    name: 'PySimpleGUI (`import PySimpleGUI as sg`)',
    importStatement: 'import PySimpleGUI as sg',
    version: 'PySimpleGUI 5.0',
    frameworkStyle: 'tk',
    description:
      'Real PySimpleGUI layout and event, values = window.read() loop execution with sg.Text, sg.Input, sg.Slider, sg.Checkbox, sg.Combo, sg.ProgressBar, and sg.popup.',
    widgetsProvided: [
      'sg.Window',
      'sg.Text',
      'sg.Input',
      'sg.Button',
      'sg.Slider',
      'sg.Checkbox',
      'sg.Combo',
      'sg.ProgressBar',
      'sg.popup'
    ],
    snippetCode: `import PySimpleGUI as sg

sg.theme("DarkTeal9")

layout = [
    [sg.Text("PySimpleGUI Automated Invoice & GST Calculator", key="-STATUS-")],
    [sg.Input("INV-2026-8841", key="-INV-")],
    [sg.Combo(["18% Standard GST", "12% Commercial GST", "5% Essential GST"], default_value="18% Standard GST", key="-TAX-")],
    [sg.Slider(range=(100, 5000), default_value=1250, key="-AMOUNT-")],
    [sg.Checkbox("Generate Signed PDF Receipt", default=True, key="-PDF-")],
    [sg.ProgressBar(100, key="-PROG-")],
    [sg.Button("Calculate Invoice Total")]
]

window = sg.Window("PySimpleGUI Billing & Tax Desk", layout)

while True:
    event, values = window.read()
    if event == sg.WIN_CLOSED:
        break
    if event == "Calculate Invoice Total":
        inv = values.get("-INV-", "INV-001")
        amt = float(values.get("-AMOUNT-", 1000))
        tax_str = str(values.get("-TAX-", "18%"))
        rate = 0.18 if "18" in tax_str else (0.12 if "12" in tax_str else 0.05)
        total = round(amt * (1 + rate), 2)
        window["-STATUS-"].update(f"Invoice {inv}: Base \${amt:.2f} + Tax = Total \${total:.2f}")
        print(f"[PySimpleGUI] Invoice={inv} | Subtotal=\${amt:.2f} | Total=\${total:.2f}")

window.close()`
  },
  {
    id: 'py-dearpygui',
    language: 'python',
    name: 'DearPyGui (`import dearpygui.dearpygui as dpg`)',
    importStatement: 'import dearpygui.dearpygui as dpg',
    version: 'DearPyGui 1.11 GPU',
    frameworkStyle: 'imgui',
    description:
      'Real DearPyGui GPU immediate-mode execution with dpg.window, add_text, add_input_text, add_slider_float, add_checkbox, add_combo, add_button callbacks, and get_value/set_value.',
    widgetsProvided: [
      'dpg.window',
      'dpg.add_text',
      'dpg.add_button',
      'dpg.add_input_text',
      'dpg.add_slider_float',
      'dpg.add_checkbox',
      'dpg.add_combo',
      'dpg.add_progress_bar'
    ],
    snippetCode: `import dearpygui.dearpygui as dpg

dpg.create_context()
dpg.create_viewport(title="DearPyGui GPU Shader & Physics Profiler", width=600, height=460)

def recompile_pipeline(sender, app_data, user_data):
    shader = dpg.get_value("shader_tag")
    fov = float(dpg.get_value("fov_tag") or 75)
    vsync = dpg.get_value("vsync_tag")
    dpg.set_value("status_tag", f"Compiled {shader} | FOV={fov:.1f}° | VSync={vsync}")
    print(f"[DearPyGui Callback] Shader={shader} | FOV={fov:.1f} | VSync={vsync}")

with dpg.window(label="DearPyGui Real-Time Render Pipeline"):
    dpg.add_text("DearPyGui Vulkan/OpenGL Pipeline Ready", tag="status_tag")
    dpg.add_input_text(label="Fragment Shader", default_value="pbr_raymarch_clouds.frag", tag="shader_tag")
    dpg.add_combo(items=["MSAA 8x Ultra", "TAA Temporal", "DLSS Super-Res"], label="Anti-Aliasing", default_value="MSAA 8x Ultra")
    dpg.add_slider_float(label="Camera Field of View", default_value=78.0, min_value=45.0, max_value=120.0, tag="fov_tag")
    dpg.add_checkbox(label="Lock 120Hz Adaptive VSync", default_value=True, tag="vsync_tag")
    dpg.add_progress_bar(label="VRAM Allocation", default_value=0.68)
    dpg.add_button(label="Recompile GPU Shader Pipeline", callback=recompile_pipeline)

dpg.setup_dearpygui()
dpg.show_viewport()
dpg.start_dearpygui()
dpg.destroy_context()`
  },
  {
    id: 'py-turtle',
    language: 'python',
    name: 'Turtle Graphics (`import turtle` Vector Canvas)',
    importStatement: 'import turtle',
    version: 'Python 3 Standard Turtle',
    frameworkStyle: 'tk',
    description:
      'Real Python Turtle geometry execution calculating exact 2D trigonometry for forward, left, right, circle, goto, begin_fill, end_fill, and rendering live on the vector canvas.',
    widgetsProvided: [
      'turtle.Screen',
      'turtle.Turtle',
      'forward',
      'backward',
      'left',
      'right',
      'circle',
      'goto',
      'color',
      'begin_fill',
      'end_fill',
      'write'
    ],
    snippetCode: `import turtle

screen = turtle.Screen()
screen.title("Python Turtle Geometric Mandala & Vector Plotter")
screen.bgcolor("#070B14")

t = turtle.Turtle()
t.speed(0)
t.width(2)

colors = ["#10B981", "#38BDF8", "#F59E0B", "#EC4899", "#A855F7", "#22D3EE"]

# Draw sacred geometric rosette with real turtle coordinates
for i in range(18):
    t.pencolor(colors[i % len(colors)])
    t.forward(72)
    t.left(100)
    t.forward(45)
    t.right(60)
    t.backward(72)
    t.right(20)

t.penup()
t.goto(-190, -105)
t.pencolor("#A7F3D0")
t.write("Turtle Vector Geometry Executed in Python 3", font=("Monospace", 12, "bold"))

print("[Python Turtle] Generated 18-fold geometric vector mandala on canvas")
turtle.done()`
  },
  {
    id: 'py-toga',
    language: 'python',
    name: 'BeeWare Toga (`import toga` Cross-Platform Native UI)',
    importStatement: 'import toga\nfrom toga.style import Pack',
    version: 'Toga 0.4.5 (BeeWare)',
    frameworkStyle: 'tk',
    description:
      'Real BeeWare Toga execution for Android & Desktop with toga.App, toga.MainWindow, toga.Box, toga.Label, toga.TextInput, toga.Slider, toga.Switch, and toga.Button.',
    widgetsProvided: [
      'toga.App',
      'toga.MainWindow',
      'toga.Box',
      'toga.Label',
      'toga.Button',
      'toga.TextInput',
      'toga.Slider',
      'toga.Switch',
      'toga.ProgressBar'
    ],
    snippetCode: `import toga
from toga.style import Pack

class BeeWareFieldApp(toga.App):
    def startup(self):
        self.main_window = toga.MainWindow(title="BeeWare Toga Cross-Platform Field Inspector")
        self.status = toga.Label("BeeWare Toga Native Widget Tree Active")
        self.site_input = toga.TextInput(value="Solar Substation Array #14")
        self.output_slider = toga.Slider(value=84, min=0, max=100)
        self.grid_switch = toga.Switch("Grid Tie Inverter Synchronized", value=True)
        self.prog = toga.ProgressBar(value=84, max=100)

        def sync_reading(widget):
            site = self.site_input.get()
            lvl = self.output_slider.get()
            self.status.configure(text=f"Synced {site}: {lvl}% Capacity")
            print(f"[BeeWare Toga] Site='{site}' | Output={lvl}%")

        self.btn = toga.Button("Transmit Field Reading", on_press=sync_reading)

app = BeeWareFieldApp("BeeWare Solar Inspector", "com.shailesh.toga")
app.main_loop()`
  },
  {
    id: 'py-streamlit',
    language: 'python',
    name: 'Streamlit (`import streamlit as st` Data & ML UI)',
    importStatement: 'import streamlit as st',
    version: 'Streamlit 1.38',
    frameworkStyle: 'flutter-material',
    description:
      'Real Streamlit reactive Python script execution with st.title, st.text_input, st.slider, st.selectbox, st.checkbox, st.progress, st.button, and st.success.',
    widgetsProvided: [
      'st.title',
      'st.header',
      'st.write',
      'st.text_input',
      'st.slider',
      'st.selectbox',
      'st.checkbox',
      'st.progress',
      'st.button',
      'st.success'
    ],
    snippetCode: `import streamlit as st

st.title("Streamlit Real-Time Financial Risk & Portfolio Engine")

ticker = st.text_input("Asset Portfolio Ticker", "NIFTY50-INDEX-CORE")
strategy = st.selectbox("Quantitative Strategy", ["Mean Reversion Alpha", "Momentum Breakout", "Delta-Neutral Arbitrage"])
confidence = st.slider("VaR Confidence Interval (%)", 50, 99, 95)
hedge = st.checkbox("Enable Automated Options Tail-Hedge", True)
st.progress(confidence)

if st.button("Run Monte Carlo Portfolio Simulation"):
    sharpe = round(1.15 + (confidence - 50) * 0.025, 2)
    st.write(f"Simulation Result for {ticker} ({strategy}): Estimated Sharpe Ratio = {sharpe}")
    st.success(f"Portfolio Verified: {ticker} | Confidence: {confidence}% | Sharpe: {sharpe}")
    print(f"[Streamlit Engine] Ticker={ticker} | Strategy={strategy} | Sharpe={sharpe}")`
  },

  // ================= DART GUI MODULES =================
  {
    id: 'dart-flutter-material',
    language: 'dart',
    name: 'Flutter Material 3 (`package:flutter/material.dart`)',
    importStatement: "import 'package:flutter/material.dart';",
    version: 'Flutter 3.24 / Material 3',
    frameworkStyle: 'flutter-material',
    description:
      'Complete Google Material Design 3 widget tree with Scaffold, AppBar, Cards, Sliders, Switches, TextFields, and FAB.',
    widgetsProvided: [
      'MaterialApp',
      'Scaffold',
      'AppBar',
      'Card',
      'Text',
      'ElevatedButton',
      'FilledButton',
      'TextField',
      'Slider',
      'SwitchListTile',
      'LinearProgressIndicator'
    ],
    snippetCode: `import 'package:flutter/material.dart';

void main() => runApp(const FinTechFlutterApp());

class FinTechFlutterApp extends StatelessWidget {
  const FinTechFlutterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Material 3 Smart Wallet',
      home: Scaffold(
        appBar: AppBar(title: const Text('Flutter Material 3 Portfolio & Instant Pay')),
        body: Column(
          children: [
            const Text('Available Vault Balance: \$48,920.50'),
            const TextField(decoration: InputDecoration(labelText: 'Recipient UPI / Wallet Address', hintText: 'shailesh@okaxis')),
            Slider(value: 75, min: 0, max: 100, onChanged: (v) {}),
            SwitchListTile(title: const Text('Biometric Fingerprint Confirmation'), value: true, onChanged: (v) {}),
            const LinearProgressIndicator(value: 0.82),
            ElevatedButton(onPressed: () {}, child: const Text('Send Instant Transfer')),
            FilledButton(onPressed: () {}, child: const Text('Download Statement PDF')),
          ],
        ),
      ),
    );
  }
}`
  },
  {
    id: 'dart-flutter-cupertino',
    language: 'dart',
    name: 'Flutter Cupertino (`package:flutter/cupertino.dart`)',
    importStatement: "import 'package:flutter/cupertino.dart';",
    version: 'Flutter 3.24 / iOS HIG',
    frameworkStyle: 'flutter-cupertino',
    description:
      'High-precision Cupertino widgets with translucent navigation bars, CupertinoSlider, CupertinoSwitch, and rounded actions.',
    widgetsProvided: [
      'CupertinoApp',
      'CupertinoPageScaffold',
      'CupertinoNavigationBar',
      'CupertinoButton',
      'CupertinoTextField',
      'CupertinoSlider',
      'CupertinoSwitch'
    ],
    snippetCode: `import 'package:flutter/cupertino.dart';

void main() => runApp(const CupertinoStudioApp());

class CupertinoStudioApp extends StatelessWidget {
  const CupertinoStudioApp({super.key});

  @override
  Widget build(BuildContext context) {
    return CupertinoApp(
      title: 'Cupertino Audio Mastering Deck',
      home: CupertinoPageScaffold(
        navigationBar: const CupertinoNavigationBar(middle: Text('Cupertino Pro Audio Mastering')),
        child: Column(
          children: [
            const Text('Spatial Audio Bus & Compressor'),
            const CupertinoTextField(placeholder: 'Preset: Studio Vocal Warmth'),
            CupertinoSlider(value: 68, min: 0, max: 100, onChanged: (v) {}),
            CupertinoSwitch(value: true, onChanged: (v) {}),
            CupertinoButton.filled(onPressed: () {}, child: const Text('Bounce Master Track (24-Bit WAV)')),
          ],
        ),
      ),
    );
  }
}`
  },
  {
    id: 'dart-flame-canvas',
    language: 'dart',
    name: 'Flame 2D Engine & CustomPaint (`package:flame/game.dart`)',
    importStatement: "import 'package:flame/game.dart';\nimport 'dart:ui';",
    version: 'Flame 1.18',
    frameworkStyle: 'flutter-material',
    description:
      'Hardware-accelerated 2D game loop, particle emitter, collision physics, and interactive CustomPaint canvas for Dart.',
    widgetsProvided: [
      'GameWidget',
      'FlameGame',
      'CustomPaint',
      'Canvas',
      'Paint',
      'PositionComponent'
    ],
    snippetCode: `import 'package:flutter/material.dart';
import 'package:flame/game.dart';

void main() {
  runApp(
    MaterialApp(
      title: 'Dart Flame 2D Orbital Radar',
      home: Scaffold(
        appBar: AppBar(title: const Text('Flame 2D Physics & Radar Canvas')),
        body: Column(
          children: [
            const Text('Active Radar Sweep & Particle Telemetry'),
            Slider(value: 60, min: 10, max: 120, onChanged: (v) {}),
            ElevatedButton(onPressed: () {}, child: const Text('Spawn Orbital Satellite')),
            ElevatedButton(onPressed: () {}, child: const Text('Pulse Sonar Sweep')),
          ],
        ),
      ),
    ),
  );
}`
  },

  // ================= JAVA GUI MODULES =================
  {
    id: 'java-swing',
    language: 'java',
    name: 'Java Swing (`javax.swing.*`)',
    importStatement:
      'import javax.swing.*;\nimport javax.swing.table.DefaultTableModel;\nimport java.awt.*;\nimport java.awt.event.*;',
    version: 'Java SE 21 Swing',
    frameworkStyle: 'swing',
    description:
      'Full Java Swing desktop & mobile-wrapped GUI toolkit: JFrame, JPanel, JButton, JTextField, JSlider, JCheckBox, JProgressBar, and JTable.',
    widgetsProvided: [
      'JFrame',
      'JPanel',
      'JLabel',
      'JButton',
      'JTextField',
      'JSlider',
      'JCheckBox',
      'JProgressBar',
      'JComboBox',
      'JTable',
      'JOptionPane'
    ],
    snippetCode: `import javax.swing.*;
import java.awt.*;

public class Main {
    public static void main(String[] args) {
        JFrame frame = new JFrame("Java Swing ERP & Warehouse Control Center");
        frame.setSize(600, 500);
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);

        JPanel panel = new JPanel();
        JLabel title = new JLabel("Java Swing Inventory & Invoice Dispatcher");
        JTextField skuInput = new JTextField("SKU-9042-PRO-MAX", 20);
        JSlider thresholdSlider = new JSlider(0, 100, 65);
        JCheckBox gstCheck = new JCheckBox("Include 18% GST Tax Invoice Calculation", true);
        JProgressBar quotaBar = new JProgressBar(0, 100);
        quotaBar.setValue(84);

        JButton dispatchBtn = new JButton("Approve & Dispatch Shipment");
        JButton auditBtn = new JButton("Run Ledger Reconciliation");

        panel.add(title);
        panel.add(skuInput);
        panel.add(thresholdSlider);
        panel.add(gstCheck);
        panel.add(quotaBar);
        panel.add(dispatchBtn);
        panel.add(auditBtn);
        frame.add(panel);
        frame.setVisible(true);
    }
}`
  },
  {
    id: 'java-javafx',
    language: 'java',
    name: 'JavaFX 21 (`javafx.scene.control.*`)',
    importStatement:
      'import javafx.application.Application;\nimport javafx.scene.Scene;\nimport javafx.scene.control.*;\nimport javafx.scene.layout.VBox;\nimport javafx.stage.Stage;',
    version: 'JavaFX 21 LTS',
    frameworkStyle: 'javafx',
    description:
      'Modern hardware-accelerated JavaFX UI with CSS styling, Stage, Scene, VBox, HBox, Charts, Sliders, and Observable tables.',
    widgetsProvided: [
      'Application',
      'Stage',
      'Scene',
      'VBox',
      'HBox',
      'Label',
      'Button',
      'TextField',
      'Slider',
      'CheckBox',
      'ProgressBar',
      'TableView'
    ],
    snippetCode: `import javafx.application.Application;
import javafx.scene.Scene;
import javafx.scene.control.*;
import javafx.scene.layout.VBox;
import javafx.stage.Stage;

public class Main extends Application {
    @Override
    public void start(Stage stage) {
        stage.setTitle("JavaFX 21 Financial Analytics & Trading Terminal");

        Label header = new Label("JavaFX Algorithmic Order Execution Engine");
        TextField symbolField = new TextField("NIFTY50-FUT-DEC");
        Slider leverageSlider = new Slider(1, 20, 5);
        CheckBox hedgeCheck = new CheckBox("Auto-Delta Gamma Hedging Protection");
        hedgeCheck.setSelected(true);
        ProgressBar marginBar = new ProgressBar(0.68);

        Button buyBtn = new Button("Execute Limit Order");
        Button rebalanceBtn = new Button("Rebalance Portfolio Weights");

        VBox root = new VBox(12, header, symbolField, leverageSlider, hedgeCheck, marginBar, buyBtn, rebalanceBtn);
        stage.setScene(new Scene(root, 560, 460));
        stage.show();
    }

    public static void main(String[] args) {
        launch(args);
    }
}`
  },
  {
    id: 'java-android-ui',
    language: 'java',
    name: 'Android Native UI & AWT (`android.widget.*` / `java.awt.*`)',
    importStatement: 'import android.app.Activity;\nimport android.widget.*;\nimport java.awt.*;',
    version: 'Android API 34 / AWT',
    frameworkStyle: 'android-ui',
    description:
      'Native Android View widgets (LinearLayout, TextView, Button, EditText, SeekBar, Switch) and Java AWT Graphics2D Canvas.',
    widgetsProvided: [
      'Activity',
      'LinearLayout',
      'TextView',
      'Button',
      'EditText',
      'SeekBar',
      'Switch',
      'ProgressBar',
      'Canvas',
      'Graphics2D'
    ],
    snippetCode: `import android.app.Activity;
import android.os.Bundle;
import android.widget.*;

public class Main extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setTitle("Android Native Sensor & Battery Optimizer");

        TextView title = new TextView(this);
        title.setText("Android API 34 Kernel & Battery Governor");

        EditText profileName = new EditText(this);
        profileName.setText("Ultra-Low Latency Gaming Mode");

        SeekBar cpuClock = new SeekBar(this);
        cpuClock.setProgress(88);

        Switch playProtectSwitch = new Switch(this);
        playProtectSwitch.setText("Play Protect Verified Signature Active");
        playProtectSwitch.setChecked(true);

        Button applyBtn = new Button(this);
        applyBtn.setText("Apply Governor Profile");
    }
}`
  },

  // ================= C++ GUI MODULES =================
  {
    id: 'cpp-imgui',
    language: 'cpp',
    name: 'Dear ImGui (`#include "imgui.h"`)',
    importStatement:
      '#include "imgui.h"\n#include "imgui_impl_glfw.h"\n#include "imgui_impl_opengl3.h"',
    version: 'ImGui 1.91 Docking',
    frameworkStyle: 'imgui',
    description:
      'Bloat-free immediate mode graphical user interface for C++ with real-time telemetry plots, sliders, color pickers, and low-latency overlays.',
    widgetsProvided: [
      'ImGui::Begin',
      'ImGui::Text',
      'ImGui::Button',
      'ImGui::InputText',
      'ImGui::SliderFloat',
      'ImGui::Checkbox',
      'ImGui::ProgressBar',
      'ImGui::PlotLines'
    ],
    snippetCode: `#include "imgui.h"
#include <iostream>

void RenderGuiFrame() {
    ImGui::Begin("Dear ImGui C++20 Engine Telemetry & Shader Inspector");

    ImGui::Text("GPU Frame Time: 1.42 ms (704 FPS) | Vulkan 1.3 Backend");

    static char shaderName[64] = "PBR_Atmospheric_Scattering.frag";
    ImGui::InputText("Active Shader", shaderName, 64);

    static float exposure = 74.0f;
    ImGui::SliderFloat("HDR Exposure Bloom", &exposure, 0.0f, 100.0f);

    static bool raytracing = true;
    ImGui::Checkbox("Enable Hardware Ray-Traced Shadows (BVH)", &raytracing);

    ImGui::ProgressBar(0.86f, ImVec2(0.0f, 0.0f));

    if (ImGui::Button("Recompile SPIR-V Shaders")) {
        std::cout << "SPIR-V Shaders Compiled (0 warnings)" << std::endl;
    }
    if (ImGui::Button("Capture RenderDoc Frame")) {
        std::cout << "Frame Captured" << std::endl;
    }

    ImGui::End();
}

int main() {
    RenderGuiFrame();
    return 0;
}`
  },
  {
    id: 'cpp-qt6',
    language: 'cpp',
    name: 'Qt6 C++ Widgets (`<QApplication>`, `<QMainWindow>`)',
    importStatement:
      '#include <QApplication>\n#include <QMainWindow>\n#include <QVBoxLayout>\n#include <QPushButton>\n#include <QLabel>\n#include <QLineEdit>\n#include <QSlider>\n#include <QCheckBox>\n#include <QProgressBar>',
    version: 'Qt 6.7.2 LTS (C++20)',
    frameworkStyle: 'qt',
    description:
      'Native C++ Qt6 cross-platform GUI toolkit for mission-critical desktop, embedded Linux, and Android NDK applications.',
    widgetsProvided: [
      'QApplication',
      'QMainWindow',
      'QLabel',
      'QPushButton',
      'QLineEdit',
      'QSlider',
      'QCheckBox',
      'QProgressBar',
      'QTableWidget'
    ],
    snippetCode: `#include <QApplication>
#include <QMainWindow>
#include <QLabel>
#include <QPushButton>
#include <QLineEdit>
#include <QSlider>
#include <QCheckBox>
#include <QProgressBar>

int main(int argc, char *argv[]) {
    QApplication app(argc, argv);
    QMainWindow window;
    window.setWindowTitle("Qt6 C++20 Industrial Robotics & CNC Controller");
    window.resize(620, 480);

    QLabel *header = new QLabel("Qt6 6-Axis Robotic Arm Kinematics & G-Code Host");
    QLineEdit *gcodeInput = new QLineEdit("G01 X142.50 Y88.20 Z15.00 F3200");
    QSlider *spindleSpeed = new QSlider();
    spindleSpeed->setValue(82);

    QCheckBox *servoLock = new QCheckBox("Engage Closed-Loop Optical Encoder Lock");
    servoLock->setChecked(true);

    QProgressBar *jobProgress = new QProgressBar();
    jobProgress->setValue(68);

    QPushButton *startBtn = new QPushButton("Execute G-Code Trajectory");
    QPushButton *homeBtn = new QPushButton("Emergency Zero-Home Axes");

    window.show();
    return app.exec();
}`
  },
  {
    id: 'cpp-wx-win32-raylib',
    language: 'cpp',
    name: 'wxWidgets, Win32 API & Raylib (`<wx/wx.h>`, `<windows.h>`, `"raylib.h"`)',
    importStatement: '#include <wx/wx.h>\n#include <windows.h>\n#include "raylib.h"',
    version: 'wxWidgets 3.2 / Win32 / Raylib 5.0',
    frameworkStyle: 'raylib',
    description:
      'Native Win32 HWND controls, wxWidgets cross-platform frames, and Raylib / SFML / SDL2 hardware-accelerated 2D/3D canvas.',
    widgetsProvided: [
      'wxFrame',
      'wxButton',
      'wxSlider',
      'CreateWindowEx',
      'InitWindow',
      'GuiButton',
      'GuiSliderBar',
      'DrawCircle',
      'DrawRectangle'
    ],
    snippetCode: `#include "raylib.h"
#include <wx/wx.h>
#include <windows.h>

int main() {
    InitWindow(640, 480, "C++ Raylib & wxWidgets Audio-Visual Synthesizer");
    SetTargetFPS(60);

    // GUI Controls
    GuiLabel((Rectangle){ 24, 24, 320, 24 }, "Raylib + Win32 Real-Time Spectrum Analyzer");
    GuiTextBox((Rectangle){ 24, 60, 280, 32 }, "oscillator_sawtooth_128hz.dsp", 64, true);
    GuiSliderBar((Rectangle){ 24, 110, 280, 24 }, "Resonance Cutoff", "78%", 78.0f, 0.0f, 100.0f);
    GuiCheckBox((Rectangle){ 24, 150, 24, 24 }, "Enable 64-Bit SIMD Reverb Convolution", true);
    GuiButton((Rectangle){ 24, 195, 220, 36 }, "Trigger Polyphonic Chord");
    GuiButton((Rectangle){ 256, 195, 220, 36 }, "Export PCM Buffer");

    CloseWindow();
    return 0;
}`
  }
];

/**
 * Inspects Python, Dart, Java, or C++ source code to detect if GUI modules/libraries
 * are used and extracts an initial widget tree (which is superseded by live Python 3
 * execution when `guiScene` is returned by `/api/run-code`).
 */
export function analyzeAndExtractGuiSpec(
  language: SourceLanguage,
  code: string
): ParsedGuiApplication {
  const lower = code.toLowerCase();

  const importedModules: string[] = [];
  let detectedFrameworkId = 'console';
  let detectedFrameworkName = 'Standard Console Runtime';
  let frameworkStyle: GuiLibraryModuleSpec['frameworkStyle'] = 'tk';
  let darkMode = false;
  let accentColor = '#10B981';

  if (language === 'python') {
    if (lower.includes('customtkinter') || lower.includes('ctk.')) {
      detectedFrameworkId = 'py-customtkinter';
      detectedFrameworkName = 'CustomTkinter Modern GUI';
      frameworkStyle = 'ctk';
      darkMode = !lower.includes('set_appearance_mode("light")');
      accentColor = '#10B981';
      importedModules.push('customtkinter');
    } else if (
      lower.includes('pyqt6') ||
      lower.includes('pyqt5') ||
      lower.includes('pyside6') ||
      lower.includes('pyside2') ||
      lower.includes('qapplication')
    ) {
      detectedFrameworkId = 'py-pyqt6';
      detectedFrameworkName = 'PyQt6 / Qt Widgets GUI';
      frameworkStyle = 'qt';
      darkMode = false;
      accentColor = '#2563EB';
      importedModules.push('PyQt6.QtWidgets', 'PyQt6.QtCore', 'PyQt6.QtGui');
    } else if (lower.includes('kivy') || lower.includes('mdapp') || lower.includes('mdscreen')) {
      detectedFrameworkId = 'py-kivymd';
      detectedFrameworkName = 'Kivy & KivyMD Touch UI';
      frameworkStyle = 'kivy';
      darkMode = true;
      accentColor = '#6366F1';
      importedModules.push('kivymd.app', 'kivymd.uix');
    } else if (lower.includes('pygame')) {
      detectedFrameworkId = 'py-pygame';
      detectedFrameworkName = 'Pygame 2D Hardware Canvas Engine';
      frameworkStyle = 'flutter-material';
      darkMode = true;
      accentColor = '#06B6D4';
      importedModules.push('pygame');
    } else if (lower.includes('import flet') || lower.includes('ft.page')) {
      detectedFrameworkId = 'py-flet';
      detectedFrameworkName = 'Flet (Flutter for Python)';
      frameworkStyle = 'flutter-material';
      darkMode = true;
      accentColor = '#06B6D4';
      importedModules.push('flet');
    } else if (lower.includes('pysimplegui') || lower.includes('freesimplegui') || lower.includes('sg.window')) {
      detectedFrameworkId = 'py-pysimplegui';
      detectedFrameworkName = 'PySimpleGUI Desktop UI';
      frameworkStyle = 'tk';
      darkMode = true;
      accentColor = '#0D9488';
      importedModules.push('PySimpleGUI');
    } else if (lower.includes('dearpygui') || lower.includes('dpg.')) {
      detectedFrameworkId = 'py-dearpygui';
      detectedFrameworkName = 'DearPyGui GPU Immediate-Mode UI';
      frameworkStyle = 'imgui';
      darkMode = true;
      accentColor = '#3B82F6';
      importedModules.push('dearpygui.dearpygui');
    } else if (lower.includes('import turtle') || lower.includes('turtle.')) {
      detectedFrameworkId = 'py-turtle';
      detectedFrameworkName = 'Python Turtle Vector Graphics';
      frameworkStyle = 'tk';
      darkMode = true;
      accentColor = '#10B981';
      importedModules.push('turtle');
    } else if (lower.includes('import toga') || lower.includes('toga.')) {
      detectedFrameworkId = 'py-toga';
      detectedFrameworkName = 'BeeWare Toga Native UI';
      frameworkStyle = 'tk';
      darkMode = false;
      accentColor = '#D97706';
      importedModules.push('toga');
    } else if (lower.includes('import streamlit') || lower.includes('st.')) {
      detectedFrameworkId = 'py-streamlit';
      detectedFrameworkName = 'Streamlit Data & ML UI';
      frameworkStyle = 'flutter-material';
      darkMode = false;
      accentColor = '#E11D48';
      importedModules.push('streamlit');
    } else if (lower.includes('import wx') || lower.includes('wx.')) {
      detectedFrameworkId = 'py-wxpython';
      detectedFrameworkName = 'wxPython Native Desktop GUI';
      frameworkStyle = 'wx';
      darkMode = false;
      accentColor = '#0284C7';
      importedModules.push('wx');
    } else if (lower.includes('tkinter') || lower.includes('tk.tk') || lower.includes('ttk.')) {
      detectedFrameworkId = 'py-tkinter';
      detectedFrameworkName = 'Tkinter & TTK GUI';
      frameworkStyle = 'tk';
      darkMode = false;
      accentColor = '#0F172A';
      importedModules.push('tkinter', 'tkinter.ttk');
    }
  } else if (language === 'dart') {
    if (lower.includes('cupertino.dart') || lower.includes('cupertinoapp')) {
      detectedFrameworkId = 'dart-flutter-cupertino';
      detectedFrameworkName = 'Flutter Cupertino (iOS Style)';
      frameworkStyle = 'flutter-cupertino';
      darkMode = false;
      accentColor = '#007AFF';
      importedModules.push('package:flutter/cupertino.dart');
    } else if (lower.includes('flame/') || lower.includes('flamegame')) {
      detectedFrameworkId = 'dart-flame-canvas';
      detectedFrameworkName = 'Flutter + Flame 2D Game Engine';
      frameworkStyle = 'flutter-material';
      darkMode = true;
      accentColor = '#F59E0B';
      importedModules.push('package:flame/game.dart', 'package:flutter/material.dart');
    } else if (
      lower.includes('material.dart') ||
      lower.includes('materialapp') ||
      lower.includes('scaffold') ||
      lower.includes('widget')
    ) {
      detectedFrameworkId = 'dart-flutter-material';
      detectedFrameworkName = 'Flutter Material 3 UI';
      frameworkStyle = 'flutter-material';
      darkMode = false;
      accentColor = '#02569B';
      importedModules.push('package:flutter/material.dart');
    }
  } else if (language === 'java') {
    if (lower.includes('javafx.') || lower.includes('stage.setscene')) {
      detectedFrameworkId = 'java-javafx';
      detectedFrameworkName = 'JavaFX 21 SceneGraph UI';
      frameworkStyle = 'javafx';
      darkMode = false;
      accentColor = '#2563EB';
      importedModules.push('javafx.application.Application', 'javafx.scene.control.*');
    } else if (
      lower.includes('android.widget') ||
      lower.includes('android.app.activity') ||
      lower.includes('seekbar')
    ) {
      detectedFrameworkId = 'java-android-ui';
      detectedFrameworkName = 'Android Native Widget UI';
      frameworkStyle = 'android-ui';
      darkMode = true;
      accentColor = '#10B981';
      importedModules.push('android.app.Activity', 'android.widget.*');
    } else if (
      lower.includes('javax.swing') ||
      lower.includes('jframe') ||
      lower.includes('jbutton') ||
      lower.includes('java.awt')
    ) {
      detectedFrameworkId = 'java-swing';
      detectedFrameworkName = 'Java Swing & AWT Desktop UI';
      frameworkStyle = 'swing';
      darkMode = false;
      accentColor = '#B45309';
      importedModules.push('javax.swing.*', 'java.awt.*');
    }
  } else if (language === 'cpp') {
    if (lower.includes('imgui.h') || lower.includes('imgui::')) {
      detectedFrameworkId = 'cpp-imgui';
      detectedFrameworkName = 'Dear ImGui Immediate-Mode GPU UI';
      frameworkStyle = 'imgui';
      darkMode = true;
      accentColor = '#3B82F6';
      importedModules.push('imgui.h', 'imgui_impl_opengl3.h');
    } else if (
      lower.includes('qapplication') ||
      lower.includes('qmainwindow') ||
      lower.includes('qpushbutton')
    ) {
      detectedFrameworkId = 'cpp-qt6';
      detectedFrameworkName = 'Qt6 C++ Native Widgets';
      frameworkStyle = 'qt';
      darkMode = false;
      accentColor = '#059669';
      importedModules.push('<QApplication>', '<QMainWindow>', '<QWidgets>');
    } else if (
      lower.includes('raylib.h') ||
      lower.includes('wx/wx.h') ||
      lower.includes('windows.h') ||
      lower.includes('gtkmm.h') ||
      lower.includes('initwindow')
    ) {
      detectedFrameworkId = 'cpp-wx-win32-raylib';
      detectedFrameworkName = lower.includes('raylib')
        ? 'Raylib + Win32 Hardware GUI'
        : 'wxWidgets / Win32 Native C++ GUI';
      frameworkStyle = 'raylib';
      darkMode = true;
      accentColor = '#10B981';
      importedModules.push('raylib.h', 'wx/wx.h', 'windows.h');
    }
  }

  const hasExplicitGui = detectedFrameworkId !== 'console';

  const titleMatch =
    code.match(/\.title\s*\(\s*["']([^"']+)["']\s*\)/) ||
    code.match(/setWindowTitle\s*\(\s*["']([^"']+)["']\s*\)/) ||
    code.match(/setTitle\s*\(\s*["']([^"']+)["']\s*\)/) ||
    code.match(/set_caption\s*\(\s*["']([^"']+)["']\s*\)/) ||
    code.match(/new\s+JFrame\s*\(\s*["']([^"']+)["']\s*\)/) ||
    code.match(/ImGui::Begin\s*\(\s*["']([^"']+)["']/) ||
    code.match(/InitWindow\s*\(\s*\d+\s*,\s*\d+\s*,\s*["']([^"']+)["']\s*\)/) ||
    code.match(/title\s*[:=]\s*(?:const\s+)?(?:Text\s*\(\s*)?["']([^"']+)["']/);

  const windowTitle = titleMatch ? titleMatch[1] : `${detectedFrameworkName} Window`;

  const widgets: ExtractedGuiWidget[] = [];
  let wIdx = 1;

  const lines = code.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('#')) continue;

    // 1. Extract Labels / Text widgets
    const labelMatch =
      line.match(/(?:Label|CTkLabel|MDLabel|StaticText)\s*\([^)]*(?:text|label)\s*=\s*["']([^"']+)["']/i) ||
      line.match(/StringVar\s*\([^)]*value\s*=\s*["']([^"']+)["']/i) ||
      line.match(/(?:QLabel|JLabel|Label|add_text|st\.title|st\.write)\s*\(\s*["']([^"']+)["']/) ||
      line.match(/ft\.Text\s*\([^)]*(?:value\s*=\s*)?["']([^"']+)["']/) ||
      line.match(/sg\.Text\s*\(\s*["']([^"']+)["']/) ||
      line.match(/ImGui::Text\s*\(\s*["']([^"']+)["']/) ||
      line.match(/GuiLabel\s*\([^,]+,\s*["']([^"']+)["']\s*\)/) ||
      line.match(/setText\s*\(\s*["']([^"']+)["']\s*\)/) ||
      (line.includes('Text(') &&
        !line.includes('Button') &&
        !line.includes('AppBar') &&
        line.match(/Text\s*\(\s*["']([^"']+)["']\s*\)/));

    if (labelMatch) {
      widgets.push({
        id: `tk_${wIdx++}`,
        type: widgets.length === 0 ? 'header' : 'label',
        label: labelMatch[1].replace(/\\\$/g, '$')
      });
      continue;
    }

    // 2. Extract Text Inputs / Entries
    const inputMatch =
      line.match(/(?:insert|setText)\s*\(\s*(?:0\s*,\s*)?["']([^"']+)["']\s*\)/) ||
      line.match(
        /(?:CTkEntry|MDTextField|TextField|CupertinoTextField|TextCtrl|TextInput|add_input_text)\s*\([^)]*(?:placeholder_text|placeholder|hintText|labelText|text|value|default_value)\s*[:=]\s*["']([^"']+)["']/i
      ) ||
      line.match(/(?:QLineEdit|JTextField|TextField|sg\.Input)\s*\(\s*["']([^"']+)["']/) ||
      line.match(/st\.text_input\s*\(\s*["'][^"']+["']\s*,\s*["']([^"']+)["']/) ||
      line.match(/static\s+char\s+\w+\[\d*\]\s*=\s*["']([^"']+)["']/) ||
      line.match(/GuiTextBox\s*\([^,]+,\s*["']([^"']+)["']/);

    if (inputMatch) {
      widgets.push({
        id: `tk_${wIdx++}`,
        type: 'input',
        label: 'Input Parameter',
        value: inputMatch[1],
        defaultValue: inputMatch[1]
      });
      continue;
    }

    // 3. Extract Sliders / Scales / SeekBars
    if (
      /Scale|CTkSlider|QSlider|MDSlider|Slider|CupertinoSlider|JSlider|SeekBar|SliderFloat|GuiSliderBar|add_slider/i.test(
        line
      )
    ) {
      const valMatch =
        line.match(/(?:value|setValue|setProgress|\.set|default_value)\s*[:=(]\s*(\d+(?:\.\d+)?)/i) ||
        line.match(/Slider\s*\(\s*\d+\s*,\s*\d+\s*,\s*(\d+)/) ||
        line.match(/,\s*(\d+(?:\.\d+)?)f?\s*,/);
      const numVal = valMatch ? Math.min(256, Math.max(0, Math.round(parseFloat(valMatch[1])))) : 68;
      const nameMatch = line.match(/["']([^"']+)["']/);
      widgets.push({
        id: `tk_${wIdx++}`,
        type: 'slider',
        label: nameMatch ? nameMatch[1] : 'Interactive Control Parameter',
        value: numVal,
        defaultValue: numVal,
        min: 0,
        max: Math.max(100, numVal)
      });
      continue;
    }

    // 4. Extract Checkboxes / Switches
    const checkMatch =
      line.match(/(?:Checkbutton|CTkSwitch|MDSwitch|Switch|Checkbox|add_checkbox)\s*\([^)]*(?:text|label)\s*=\s*["']([^"']+)["']/i) ||
      line.match(/(?:QCheckBox|JCheckBox|CheckBox|st\.checkbox)\s*\(\s*["']([^"']+)["']/) ||
      line.match(/SwitchListTile\s*\([^)]*title\s*:\s*(?:const\s+)?Text\s*\(\s*["']([^"']+)["']\s*\)/) ||
      line.match(/CupertinoSwitch\s*\(/) ||
      line.match(/ImGui::Checkbox\s*\(\s*["']([^"']+)["']/) ||
      line.match(/GuiCheckBox\s*\([^,]+,\s*["']([^"']+)["']/);

    if (checkMatch) {
      widgets.push({
        id: `tk_${wIdx++}`,
        type: 'switch',
        label: checkMatch[1] || 'Enable Real-Time Hardware Acceleration',
        value: true,
        defaultValue: true
      });
      continue;
    }

    // 5. Extract ProgressBars
    if (
      /Progressbar|CTkProgressBar|QProgressBar|LinearProgressIndicator|JProgressBar|ProgressBar|wx\.Gauge|add_progress_bar|st\.progress/i.test(
        line
      )
    ) {
      const progMatch = line.match(/(\d+(?:\.\d+)?)/);
      let pct = 78;
      if (progMatch) {
        const raw = parseFloat(progMatch[1]);
        pct = raw <= 1 ? Math.round(raw * 100) : Math.min(100, Math.round(raw));
      }
      widgets.push({
        id: `tk_${wIdx++}`,
        type: 'progress',
        label: 'System Task / Buffer Completion',
        value: pct,
        defaultValue: pct
      });
      continue;
    }

    // 6. Extract Buttons
    const btnMatch =
      line.match(
        /(?:Button|CTkButton|MDRaisedButton|ElevatedButton|add_button)\s*\([^)]*(?:text|label)\s*[:=]\s*["']([^"']+)["']/i
      ) ||
      line.match(/(?:QPushButton|JButton|Button|sg\.Button|st\.button|toga\.Button)\s*\(\s*["']([^"']+)["']/) ||
      line.match(
        /(?:ElevatedButton|FilledButton|CupertinoButton(?:\.filled)?)\s*\([^)]*child\s*:\s*(?:const\s+)?Text\s*\(\s*["']([^"']+)["']\s*\)/
      ) ||
      line.match(/ImGui::Button\s*\(\s*["']([^"']+)["']\s*\)/) ||
      line.match(/GuiButton\s*\([^,]+,\s*["']([^"']+)["']\s*\)/);

    if (btnMatch) {
      widgets.push({
        id: `tk_${wIdx++}`,
        type: 'button',
        label: btnMatch[1]
      });
      continue;
    }
  }

  if (
    lower.includes('pygame') ||
    lower.includes('turtle') ||
    lower.includes('flame') ||
    lower.includes('raylib') ||
    lower.includes('canvas') ||
    lower.includes('plotlines')
  ) {
    widgets.push({
      id: `tk_canvas_${wIdx++}`,
      type: 'canvas',
      label: 'Interactive 60 FPS Hardware Canvas & Vector Surface'
    });
  }

  if (widgets.length === 0) {
    widgets.push(
      {
        id: 'w-auto-hdr',
        type: 'header',
        label: `${language.toUpperCase()} Interactive Application Controller`
      },
      {
        id: 'w-auto-inp',
        type: 'input',
        label: 'Runtime Input Argument',
        value: 'Production Dataset v1.0',
        defaultValue: 'Production Dataset v1.0'
      },
      {
        id: 'w-auto-sld',
        type: 'slider',
        label: 'Iteration / Precision Scale',
        value: 75,
        defaultValue: 75,
        min: 1,
        max: 100
      },
      {
        id: 'w-auto-chk',
        type: 'switch',
        label: 'Enable Verbose Telemetry & Validation',
        value: true,
        defaultValue: true
      },
      {
        id: 'w-auto-prg',
        type: 'progress',
        label: 'Execution Pipeline Load',
        value: 85,
        defaultValue: 85
      },
      {
        id: 'w-auto-btn1',
        type: 'button',
        label: 'Execute Primary Routine'
      }
    );
  }

  return {
    hasGui: hasExplicitGui || widgets.length > 0,
    detectedFrameworkId,
    detectedFrameworkName,
    frameworkStyle,
    windowTitle,
    windowWidth: 560,
    windowHeight: 480,
    accentColor,
    darkMode,
    importedModules,
    widgets
  };
}
