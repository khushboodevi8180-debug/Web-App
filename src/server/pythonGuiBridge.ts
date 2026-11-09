/**
 * Real Python 3 GUI Virtual Display & Widget Execution Bridge (sitecustomize.py)
 *
 * Provides working Python runtime modules for all major Python GUI frameworks:
 *  1. tkinter (tk, ttk, messagebox, filedialog, colorchooser, scrolledtext, font, constants)
 *  2. customtkinter (CTk, CTkFrame, CTkLabel, CTkButton, CTkEntry, CTkSlider, CTkSwitch, CTkProgressBar, CTkOptionMenu, CTkComboBox, CTkCheckBox, CTkTextbox, etc.)
 *  3. kivy & kivymd (App, MDApp, BoxLayout, GridLayout, MDScreen, MDLabel, MDRaisedButton, MDTextField, MDSlider, MDSwitch, Canvas, etc.)
 *  4. pygame (display, Surface, Rect, Color, draw, font, time, event, key, mouse, sprite, math, mixer)
 *  5. PyQt6 / PyQt5 / PySide6 / PySide2 (QtWidgets, QtCore, QtGui — QApplication, QMainWindow, QWidget, QLabel, QPushButton, QLineEdit, QSlider, QCheckBox, QProgressBar, QComboBox, QTableWidget, QMessageBox, Signals/Slots)
 *  6. wxPython (wx.App, wx.Frame, wx.Panel, wx.BoxSizer, wx.StaticText, wx.Button, wx.TextCtrl, wx.Slider, wx.CheckBox, wx.Gauge, wx.Choice, wx.MessageBox)
 *  7. Flet (ft.Page, ft.app, ft.Text, ft.ElevatedButton, ft.FilledButton, ft.TextField, ft.Slider, ft.Switch, ft.Checkbox, ft.Dropdown, ft.ProgressBar)
 *  8. PySimpleGUI / FreeSimpleGUI (sg.Window, sg.Text, sg.Input, sg.Button, sg.Slider, sg.Checkbox, sg.Combo, sg.ProgressBar, sg.Table, sg.popup)
 *  9. DearPyGui (dearpygui.dearpygui — window, add_text, add_button, add_input_text, add_slider_float, add_slider_int, add_checkbox, add_combo, add_progress_bar, add_plot)
 * 10. Turtle Graphics (turtle.Screen, turtle.Turtle — forward, backward, left, right, goto, circle, color, begin_fill, end_fill, dot, write)
 * 11. Toga / BeeWare (toga.App, toga.MainWindow, toga.Box, toga.Label, toga.Button, toga.TextInput, toga.Slider, toga.Switch, toga.ProgressBar)
 * 12. Gradio / NiceGUI / Streamlit (gr.Interface, gr.Blocks, ui.*, st.*)
 */

export const PYTHON_GUI_BRIDGE_SITECUSTOMIZE = String.raw`
import sys
import os
import json
import math
import types
import atexit

# Read incoming interactive state from browser (widget values, clicked button ID, canvas click, etc.)
_RAW_STATE = os.environ.get("WEBAPK_GUI_STATE_JSON", "{}")
try:
    _INCOMING_STATE = json.loads(_RAW_STATE)
except Exception:
    _INCOMING_STATE = {}

_INPUT_VALUES = _INCOMING_STATE.get("values", {})
_TRIGGER_ID = _INCOMING_STATE.get("triggerWidgetId", None)
_TRIGGER_LABEL = _INCOMING_STATE.get("triggerLabel", None)
_CANVAS_CLICK = _INCOMING_STATE.get("canvasClick", None)
_KEY_PRESSED = _INCOMING_STATE.get("keyPressed", None)
_OUT_PATH = os.environ.get("WEBAPK_GUI_OUT_PATH", "")

class _GuiSceneManager:
    def __init__(self):
        self.framework_id = "py-tkinter"
        self.framework_name = "Python GUI Runtime"
        self.framework_style = "tk"
        self.window_title = "Python GUI Application"
        self.window_width = 560
        self.window_height = 460
        self.dark_mode = False
        self.accent_color = "#0F172A"
        self.bg_color = ""
        self.widgets = []
        self.widget_map = {}
        self.callbacks = {}
        self.dialogs = []
        self.canvas_commands = []
        self.canvas_width = 500
        self.canvas_height = 240
        self.has_canvas = False
        self.counter = 0
        self.loop_executed = False

    def set_framework(self, fw_id, fw_name, style, dark=False, accent="#10B981"):
        self.framework_id = fw_id
        self.framework_name = fw_name
        self.framework_style = style
        self.dark_mode = dark
        self.accent_color = accent

    def next_id(self, prefix="w"):
        self.counter += 1
        return f"{prefix}_{self.counter}"

    def register_widget(self, w_dict, py_obj=None, callback=None):
        wid = w_dict["id"]
        # Apply incoming user state if present
        if wid in _INPUT_VALUES:
            w_dict["value"] = _INPUT_VALUES[wid]
        self.widgets.append(w_dict)
        if py_obj is not None:
            self.widget_map[wid] = py_obj
        if callable(callback):
            self.callbacks[wid] = callback
        return wid

    def add_dialog(self, dlg_type, title, message):
        self.dialogs.append({
            "type": dlg_type,
            "title": str(title),
            "message": str(message)
        })
        print(f"[{dlg_type.upper()}] {title}: {message}")

    def add_canvas_cmd(self, cmd):
        self.has_canvas = True
        self.canvas_commands.append(cmd)

    def run_event_cycle(self):
        if self.loop_executed:
            return
        self.loop_executed = True

        # 1. Sync incoming user values to Python widget objects
        for wid, obj in list(self.widget_map.items()):
            if wid in _INPUT_VALUES and hasattr(obj, "_apply_external_value"):
                try:
                    obj._apply_external_value(_INPUT_VALUES[wid])
                except Exception:
                    pass

        # 2. Fire triggered widget callback if user clicked a button or adjusted a control
        target_cb = None
        if _TRIGGER_ID and _TRIGGER_ID in self.callbacks:
            target_cb = self.callbacks[_TRIGGER_ID]
        elif _TRIGGER_LABEL:
            for w in self.widgets:
                if w.get("label") == _TRIGGER_LABEL and w["id"] in self.callbacks:
                    target_cb = self.callbacks[w["id"]]
                    break

        if callable(target_cb):
            try:
                import inspect
                sig = inspect.signature(target_cb)
                params = [
                    p for p in sig.parameters.values()
                    if p.default is inspect.Parameter.empty
                    and p.kind in (inspect.Parameter.POSITIONAL_ONLY, inspect.Parameter.POSITIONAL_OR_KEYWORD)
                ]
                if len(params) == 0:
                    target_cb()
                elif len(params) == 1:
                    w_obj = self.widget_map.get(_TRIGGER_ID)
                    val = _INPUT_VALUES.get(_TRIGGER_ID, w_obj.get() if hasattr(w_obj, "get") else None)
                    target_cb(val if val is not None else w_obj)
                else:
                    target_cb(self.widget_map.get(_TRIGGER_ID), None)
            except TypeError:
                try:
                    target_cb()
                except Exception as e:
                    print(f"Callback Error: {e}", file=sys.stderr)
            except Exception as e:
                print(f"Callback Error: {e}", file=sys.stderr)

        # 3. Sync updated Python widget properties back into serializable widget dicts
        for w in self.widgets:
            wid = w["id"]
            obj = self.widget_map.get(wid)
            if obj is not None and hasattr(obj, "_sync_to_dict"):
                try:
                    obj._sync_to_dict(w)
                except Exception:
                    pass

    def flush_to_disk(self):
        if not self.loop_executed:
            self.run_event_cycle()
        if not _OUT_PATH:
            return
        if self.has_canvas and not any(w.get("type") == "canvas" for w in self.widgets):
            self.widgets.append({
                "id": "w_canvas_surface",
                "type": "canvas",
                "label": f"{self.framework_name} 2D Graphics Surface ({self.canvas_width}x{self.canvas_height})",
                "width": self.canvas_width,
                "height": self.canvas_height
            })
        payload = {
            "hasGui": len(self.widgets) > 0 or self.has_canvas,
            "detectedFrameworkId": self.framework_id,
            "detectedFrameworkName": self.framework_name,
            "frameworkStyle": self.framework_style,
            "windowTitle": self.window_title,
            "windowWidth": self.window_width,
            "windowHeight": self.window_height,
            "darkMode": self.dark_mode,
            "accentColor": self.accent_color,
            "bgColor": self.bg_color,
            "widgets": self.widgets,
            "dialogs": self.dialogs,
            "canvasCommands": self.canvas_commands,
            "canvasWidth": self.canvas_width,
            "canvasHeight": self.canvas_height
        }
        try:
            with open(_OUT_PATH, "w", encoding="utf-8") as f:
                json.dump(payload, f)
        except Exception:
            pass

_SCENE = _GuiSceneManager()
atexit.register(_SCENE.flush_to_disk)


# ============================================================================
# SHARED REACTIVE VARIABLE CLASSES (StringVar, IntVar, DoubleVar, BooleanVar)
# ============================================================================
class Variable:
    def __init__(self, master=None, value=None, name=None):
        self._value = "" if value is None else value
        self._callbacks = []

    def set(self, value):
        self._value = value
        for cb in list(self._callbacks):
            try:
                cb()
            except Exception:
                pass

    def get(self):
        return self._value

    def trace_add(self, mode, callback):
        self._callbacks.append(lambda: callback(None, None, mode))

    def trace(self, mode, callback):
        self._callbacks.append(lambda: callback(None, None, mode))

    def __str__(self):
        return str(self._value)

class StringVar(Variable):
    def __init__(self, master=None, value="", name=None):
        super().__init__(master, "" if value is None else str(value), name)
    def get(self):
        return str(self._value)

class IntVar(Variable):
    def __init__(self, master=None, value=0, name=None):
        super().__init__(master, int(value) if value is not None else 0, name)
    def get(self):
        try:
            return int(float(self._value))
        except Exception:
            return 0

class DoubleVar(Variable):
    def __init__(self, master=None, value=0.0, name=None):
        super().__init__(master, float(value) if value is not None else 0.0, name)
    def get(self):
        try:
            return float(self._value)
        except Exception:
            return 0.0

class BooleanVar(Variable):
    def __init__(self, master=None, value=False, name=None):
        super().__init__(master, bool(value), name)
    def get(self):
        if isinstance(self._value, str):
            return self._value.lower() in ("1", "true", "yes", "on")
        return bool(self._value)


# ============================================================================
# 1. TKINTER & CUSTOMTKINTER ENGINE
# ============================================================================
class _BaseTkWidget:
    def __init__(self, master=None, wtype="label", **kwargs):
        self.master = master
        self._wtype = wtype
        self._kwargs = dict(kwargs)
        self._id = _SCENE.next_id("tk")
        self._text = kwargs.get("text", kwargs.get("label", ""))
        self._textvariable = kwargs.get("textvariable", None)
        self._variable = kwargs.get("variable", None)
        self._command = kwargs.get("command", None)
        self._values = kwargs.get("values", [])
        self._from = kwargs.get("from_", kwargs.get("from", 0))
        self._to = kwargs.get("to", kwargs.get("maximum", 100))
        self._placeholder = kwargs.get("placeholder_text", "")
        self._fg = kwargs.get("fg", kwargs.get("text_color", ""))
        self._bg = kwargs.get("bg", kwargs.get("fg_color", ""))
        self._value = kwargs.get("value", "")

        if self._textvariable is not None and isinstance(self._textvariable, Variable):
            if self._textvariable.get() != "":
                self._text = str(self._textvariable.get())
                self._value = self._textvariable.get()
            self._textvariable._callbacks.append(self._on_var_change)

        if self._variable is not None and isinstance(self._variable, Variable):
            self._value = self._variable.get()
            self._variable._callbacks.append(self._on_var_change)

        if wtype == "slider" and self._value == "":
            self._value = (float(self._from) + float(self._to)) / 2.0
        elif wtype == "switch" and self._value == "":
            self._value = False
        elif wtype == "progress" and self._value == "":
            self._value = 0
        elif wtype == "select" and self._value == "" and self._values:
            self._value = self._values[0]

        self._w_dict = None
        if wtype not in ("container", "root"):
            self._register()

    def _on_var_change(self):
        if self._textvariable is not None:
            if self._wtype in ("label", "header", "button"):
                self._text = str(self._textvariable.get())
            else:
                self._value = self._textvariable.get()
        if self._variable is not None:
            self._value = self._variable.get()

    def _register(self):
        w_dict = {
            "id": self._id,
            "type": self._wtype,
            "label": str(self._text or self._placeholder or "Field"),
            "value": self._value,
            "defaultValue": self._value,
            "placeholder": str(self._placeholder),
            "min": float(self._from) if self._wtype in ("slider", "progress") else 0,
            "max": float(self._to) if self._wtype in ("slider", "progress") else 100,
            "options": [str(x) for x in self._values] if self._values else [],
            "fgColor": str(self._fg) if isinstance(self._fg, str) else "",
            "bgColor": str(self._bg) if isinstance(self._bg, str) else ""
        }
        self._w_dict = w_dict
        _SCENE.register_widget(w_dict, self, self._command)
        # If incoming state already set a value in w_dict, sync it to self._value
        if self._id in _INPUT_VALUES:
            self._apply_external_value(_INPUT_VALUES[self._id])

    def _apply_external_value(self, val):
        self._value = val
        if self._textvariable is not None and isinstance(self._textvariable, Variable):
            self._textvariable.set(val)
        if self._variable is not None and isinstance(self._variable, Variable):
            self._variable.set(val)

    def _sync_to_dict(self, w_dict):
        if self._textvariable is not None and isinstance(self._textvariable, Variable):
            if self._wtype in ("label", "header", "button"):
                self._text = str(self._textvariable.get())
            else:
                self._value = self._textvariable.get()
        if self._variable is not None and isinstance(self._variable, Variable):
            self._value = self._variable.get()
        w_dict["label"] = str(self._text or self._placeholder or w_dict.get("label", ""))
        w_dict["value"] = self._value
        w_dict["defaultValue"] = self._value
        if self._values:
            w_dict["options"] = [str(x) for x in self._values]

    def pack(self, *args, **kwargs):
        return self
    def grid(self, *args, **kwargs):
        return self
    def place(self, *args, **kwargs):
        return self
    def pack_forget(self):
        pass
    def grid_forget(self):
        pass
    def destroy(self):
        pass
    def focus(self):
        pass
    def focus_set(self):
        pass

    def configure(self, cnf=None, **kwargs):
        if isinstance(cnf, dict):
            kwargs.update(cnf)
        if "text" in kwargs:
            self._text = str(kwargs["text"])
        if "value" in kwargs:
            self._value = kwargs["value"]
        if "values" in kwargs:
            self._values = list(kwargs["values"])
        if "command" in kwargs and callable(kwargs["command"]):
            self._command = kwargs["command"]
            _SCENE.callbacks[self._id] = self._command
        if "fg" in kwargs or "text_color" in kwargs:
            self._fg = kwargs.get("fg", kwargs.get("text_color", ""))
        if "bg" in kwargs or "fg_color" in kwargs:
            self._bg = kwargs.get("bg", kwargs.get("fg_color", ""))
        if self._w_dict is not None:
            self._sync_to_dict(self._w_dict)

    config = configure

    def cget(self, key):
        if key == "text":
            return self._text
        if key == "value":
            return self._value
        return self._kwargs.get(key, "")

    def __getitem__(self, key):
        return self.cget(key)

    def __setitem__(self, key, value):
        self.configure(**{key: value})

    def get(self, *args):
        if self._textvariable is not None:
            return self._textvariable.get()
        if self._variable is not None:
            return self._variable.get()
        return self._value

    def set(self, val):
        if self._wtype == "progress" and isinstance(val, float) and 0.0 <= val <= 1.0 and self._to == 100:
            self._value = round(val * 100, 1)
        else:
            self._value = val
        if self._textvariable is not None:
            self._textvariable.set(self._value)
        if self._variable is not None:
            self._variable.set(self._value)
        if self._w_dict is not None:
            self._sync_to_dict(self._w_dict)

    def insert(self, index, text, *args):
        # Only apply initial script insert if user hasn't overridden via live UI input
        if self._id not in _INPUT_VALUES:
            cur = str(self._value or "")
            if index in (0, "0", "1.0", "end", "END"):
                self._value = (cur + str(text)) if index in ("end", "END") else (str(text) + cur)
            else:
                self._value = str(text)
            if self._textvariable is not None:
                self._textvariable.set(self._value)
        else:
            # During a callback, allow insert to update value
            if _SCENE.loop_executed:
                cur = str(self._value or "")
                self._value = (cur + str(text)) if index in ("end", "END") else str(text)
        if self._w_dict is not None:
            self._sync_to_dict(self._w_dict)

    def delete(self, first, last=None):
        if self._id not in _INPUT_VALUES or _SCENE.loop_executed:
            self._value = ""
            if self._textvariable is not None:
                self._textvariable.set("")
            if self._w_dict is not None:
                self._sync_to_dict(self._w_dict)

    def select(self):
        if self._id not in _INPUT_VALUES or _SCENE.loop_executed:
            self.set(True)

    def deselect(self):
        if self._id not in _INPUT_VALUES or _SCENE.loop_executed:
            self.set(False)

    def toggle(self):
        self.set(not bool(self.get()))

    def invoke(self):
        if callable(self._command):
            return self._command()

    def bind(self, sequence, func, add=None):
        if callable(func) and self._id not in _SCENE.callbacks:
            _SCENE.callbacks[self._id] = lambda: func(types.SimpleNamespace(x=100, y=100, char="a", keysym="Return", widget=self))

    def after(self, ms, func=None, *args):
        # Do not infinite-loop recursive .after() timers; run once if not already run
        pass

    def winfo_width(self):
        return _SCENE.window_width
    def winfo_height(self):
        return _SCENE.window_height
    def winfo_screenwidth(self):
        return 1920
    def winfo_screenheight(self):
        return 1080
    def update(self):
        pass
    def update_idletasks(self):
        pass


class _TkRoot(_BaseTkWidget):
    def __init__(self, *args, **kwargs):
        if _SCENE.framework_id == "py-tkinter":
            _SCENE.set_framework("py-tkinter", "Tkinter & TTK (Python 3)", "tk", dark=False, accent="#0F172A")
        super().__init__(None, wtype="root", **kwargs)

    def title(self, text=None):
        if text is not None:
            _SCENE.window_title = str(text)
        return _SCENE.window_title

    def geometry(self, geom=None):
        if geom and "x" in str(geom):
            try:
                dims = str(geom).split("+")[0].split("x")
                _SCENE.window_width = int(dims[0])
                _SCENE.window_height = int(dims[1])
            except Exception:
                pass
        return f"{_SCENE.window_width}x{_SCENE.window_height}"

    def resizable(self, *args):
        pass
    def minsize(self, *args):
        pass
    def maxsize(self, *args):
        pass
    def iconbitmap(self, *args):
        pass
    def attributes(self, *args):
        pass
    def protocol(self, *args):
        pass
    def rowconfigure(self, *args, **kwargs):
        pass
    def columnconfigure(self, *args, **kwargs):
        pass
    def grid_rowconfigure(self, *args, **kwargs):
        pass
    def grid_columnconfigure(self, *args, **kwargs):
        pass

    def mainloop(self, *args):
        _SCENE.run_event_cycle()

    def quit(self):
        pass


class _TkCanvas(_BaseTkWidget):
    def __init__(self, master=None, **kwargs):
        w = int(kwargs.get("width", 480))
        h = int(kwargs.get("height", 220))
        _SCENE.canvas_width = w
        _SCENE.canvas_height = h
        _SCENE.has_canvas = True
        bg = kwargs.get("bg", kwargs.get("background", "#0F172A"))
        super().__init__(master, wtype="canvas", text="Tkinter 2D Vector Canvas", **kwargs)
        _SCENE.add_canvas_cmd({"op": "clear", "color": str(bg)})

    def create_line(self, *coords, **kwargs):
        pts = []
        for c in coords:
            if isinstance(c, (list, tuple)):
                pts.extend(c)
            else:
                pts.append(float(c))
        _SCENE.add_canvas_cmd({
            "op": "line",
            "points": pts,
            "color": str(kwargs.get("fill", "#38BDF8")),
            "width": float(kwargs.get("width", 2))
        })
        return len(_SCENE.canvas_commands)

    def create_rectangle(self, x1, y1, x2, y2, **kwargs):
        _SCENE.add_canvas_cmd({
            "op": "rect",
            "x": float(x1),
            "y": float(y1),
            "w": float(x2) - float(x1),
            "h": float(y2) - float(y1),
            "fill": str(kwargs.get("fill", "")),
            "stroke": str(kwargs.get("outline", "#94A3B8")),
            "width": float(kwargs.get("width", 1.5))
        })
        return len(_SCENE.canvas_commands)

    def create_oval(self, x1, y1, x2, y2, **kwargs):
        rx = (float(x2) - float(x1)) / 2.0
        ry = (float(y2) - float(y1)) / 2.0
        _SCENE.add_canvas_cmd({
            "op": "ellipse",
            "cx": float(x1) + rx,
            "cy": float(y1) + ry,
            "rx": abs(rx),
            "ry": abs(ry),
            "fill": str(kwargs.get("fill", "")),
            "stroke": str(kwargs.get("outline", "#10B981")),
            "width": float(kwargs.get("width", 1.5))
        })
        return len(_SCENE.canvas_commands)

    def create_polygon(self, *coords, **kwargs):
        pts = []
        for c in coords:
            if isinstance(c, (list, tuple)):
                pts.extend(c)
            else:
                pts.append(float(c))
        _SCENE.add_canvas_cmd({
            "op": "polygon",
            "points": pts,
            "fill": str(kwargs.get("fill", "#10B981")),
            "stroke": str(kwargs.get("outline", "#FFFFFF")),
            "width": float(kwargs.get("width", 1.5))
        })
        return len(_SCENE.canvas_commands)

    def create_text(self, x, y, **kwargs):
        _SCENE.add_canvas_cmd({
            "op": "text",
            "x": float(x),
            "y": float(y),
            "text": str(kwargs.get("text", "")),
            "color": str(kwargs.get("fill", "#F8FAFC"))
        })
        return len(_SCENE.canvas_commands)

    def create_arc(self, x1, y1, x2, y2, **kwargs):
        return self.create_oval(x1, y1, x2, y2, **kwargs)

    def delete(self, *args):
        if args and args[0] in ("all", "ALL"):
            _SCENE.canvas_commands.clear()


class _TkTreeview(_BaseTkWidget):
    def __init__(self, master=None, **kwargs):
        cols = list(kwargs.get("columns", ("Column 1", "Column 2")))
        super().__init__(master, wtype="table", text="Data Table", **kwargs)
        self._headers = cols
        self._rows = []
        if self._w_dict is not None:
            self._w_dict["tableHeaders"] = self._headers
            self._w_dict["tableRows"] = self._rows

    def heading(self, col, **kwargs):
        text = kwargs.get("text", str(col))
        if col in self._headers:
            idx = self._headers.index(col)
            self._headers[idx] = text
        if self._w_dict is not None:
            self._w_dict["tableHeaders"] = list(self._headers)

    def column(self, col, **kwargs):
        pass

    def insert(self, parent, index, iid=None, **kwargs):
        vals = [str(v) for v in kwargs.get("values", [])]
        if vals:
            self._rows.append(vals)
        if self._w_dict is not None:
            self._w_dict["tableRows"] = list(self._rows)
        return iid or f"row_{len(self._rows)}"

    def get_children(self):
        return [f"row_{i}" for i in range(len(self._rows))]


def _build_tkinter_modules():
    tk_mod = types.ModuleType("tkinter")
    ttk_mod = types.ModuleType("tkinter.ttk")
    msg_mod = types.ModuleType("tkinter.messagebox")
    fd_mod = types.ModuleType("tkinter.filedialog")
    cc_mod = types.ModuleType("tkinter.colorchooser")
    st_mod = types.ModuleType("tkinter.scrolledtext")
    font_mod = types.ModuleType("tkinter.font")
    const_mod = types.ModuleType("tkinter.constants")

    # Constants
    constants = {
        "N": "n", "S": "s", "E": "e", "W": "w", "NW": "nw", "NE": "ne", "SW": "sw", "SE": "se",
        "CENTER": "center", "NONE": "none", "X": "x", "Y": "y", "BOTH": "both",
        "LEFT": "left", "RIGHT": "right", "TOP": "top", "BOTTOM": "bottom",
        "RAISED": "raised", "SUNKEN": "sunken", "FLAT": "flat", "RIDGE": "ridge", "GROOVE": "groove", "SOLID": "solid",
        "HORIZONTAL": "horizontal", "VERTICAL": "vertical",
        "NORMAL": "normal", "DISABLED": "disabled", "ACTIVE": "active", "HIDDEN": "hidden",
        "END": "end", "INSERT": "insert", "CURRENT": "current", "ALL": "all",
        "TRUE": True, "FALSE": False, "YES": True, "NO": False
    }
    for k, v in constants.items():
        setattr(tk_mod, k, v)
        setattr(const_mod, k, v)

    tk_mod.Variable = Variable
    tk_mod.StringVar = StringVar
    tk_mod.IntVar = IntVar
    tk_mod.DoubleVar = DoubleVar
    tk_mod.BooleanVar = BooleanVar

    tk_mod.Tk = _TkRoot
    tk_mod.Toplevel = lambda master=None, **kw: _TkRoot(**kw)
    tk_mod.Frame = lambda master=None, **kw: _BaseTkWidget(master, "container", **kw)
    tk_mod.LabelFrame = lambda master=None, **kw: _BaseTkWidget(master, "header", **kw)
    tk_mod.PanedWindow = lambda master=None, **kw: _BaseTkWidget(master, "container", **kw)
    tk_mod.Label = lambda master=None, **kw: _BaseTkWidget(master, "label", **kw)
    tk_mod.Message = lambda master=None, **kw: _BaseTkWidget(master, "label", **kw)
    tk_mod.Button = lambda master=None, **kw: _BaseTkWidget(master, "button", **kw)
    tk_mod.Entry = lambda master=None, **kw: _BaseTkWidget(master, "input", **kw)
    tk_mod.Text = lambda master=None, **kw: _BaseTkWidget(master, "input", **kw)
    tk_mod.Scale = lambda master=None, **kw: _BaseTkWidget(master, "slider", **kw)
    tk_mod.Spinbox = lambda master=None, **kw: _BaseTkWidget(master, "slider", **kw)
    tk_mod.Checkbutton = lambda master=None, **kw: _BaseTkWidget(master, "switch", **kw)
    tk_mod.Radiobutton = lambda master=None, **kw: _BaseTkWidget(master, "switch", **kw)
    tk_mod.Listbox = lambda master=None, **kw: _BaseTkWidget(master, "select", **kw)
    tk_mod.OptionMenu = lambda master=None, var=None, val=None, *opts, **kw: _BaseTkWidget(master, "select", variable=var, value=val, values=[val] + list(opts), **kw)
    tk_mod.Scrollbar = lambda master=None, **kw: _BaseTkWidget(master, "container", **kw)
    tk_mod.Menu = lambda master=None, **kw: _BaseTkWidget(master, "container", **kw)
    tk_mod.Canvas = _TkCanvas
    tk_mod.PhotoImage = lambda *a, **kw: types.SimpleNamespace(width=lambda: 64, height=lambda: 64)

    # TTK widgets
    ttk_mod.Style = lambda *a, **kw: types.SimpleNamespace(theme_use=lambda *x: None, configure=lambda *x, **k: None, map=lambda *x, **k: None)
    ttk_mod.Frame = tk_mod.Frame
    ttk_mod.LabelFrame = tk_mod.LabelFrame
    ttk_mod.Label = tk_mod.Label
    ttk_mod.Button = tk_mod.Button
    ttk_mod.Entry = tk_mod.Entry
    ttk_mod.Scale = tk_mod.Scale
    ttk_mod.Checkbutton = tk_mod.Checkbutton
    ttk_mod.Radiobutton = tk_mod.Radiobutton
    ttk_mod.Combobox = lambda master=None, **kw: _BaseTkWidget(master, "select", **kw)
    ttk_mod.Progressbar = lambda master=None, **kw: _BaseTkWidget(master, "progress", **kw)
    ttk_mod.Notebook = tk_mod.Frame
    ttk_mod.Separator = tk_mod.Frame
    ttk_mod.Scrollbar = tk_mod.Scrollbar
    ttk_mod.Spinbox = tk_mod.Spinbox
    ttk_mod.Treeview = _TkTreeview

    # Messagebox
    msg_mod.showinfo = lambda title="Info", message="", **kw: (_SCENE.add_dialog("info", title, message), "ok")[1]
    msg_mod.showwarning = lambda title="Warning", message="", **kw: (_SCENE.add_dialog("warning", title, message), "ok")[1]
    msg_mod.showerror = lambda title="Error", message="", **kw: (_SCENE.add_dialog("error", title, message), "ok")[1]
    msg_mod.askquestion = lambda title="Question", message="", **kw: (_SCENE.add_dialog("question", title, message), "yes")[1]
    msg_mod.askyesno = lambda title="Confirm", message="", **kw: (_SCENE.add_dialog("question", title, message), True)[1]
    msg_mod.askokcancel = lambda title="Confirm", message="", **kw: (_SCENE.add_dialog("question", title, message), True)[1]

    # Filedialog & ScrolledText & Font
    fd_mod.askopenfilename = lambda **kw: "/storage/emulated/0/Download/sample_data.csv"
    fd_mod.asksaveasfilename = lambda **kw: "/storage/emulated/0/Download/export_output.csv"
    fd_mod.askdirectory = lambda **kw: "/storage/emulated/0/Download"
    cc_mod.askcolor = lambda **kw: ((16, 185, 129), "#10B981")
    st_mod.ScrolledText = tk_mod.Text
    font_mod.Font = lambda *a, **kw: types.SimpleNamespace(configure=lambda **k: None, measure=lambda s: len(str(s)) * 8)
    font_mod.nametofont = lambda *a, **kw: font_mod.Font()

    tk_mod.ttk = ttk_mod
    tk_mod.messagebox = msg_mod
    tk_mod.filedialog = fd_mod
    tk_mod.colorchooser = cc_mod
    tk_mod.scrolledtext = st_mod
    tk_mod.font = font_mod
    tk_mod.constants = const_mod

    sys.modules["tkinter"] = tk_mod
    sys.modules["_tkinter"] = tk_mod
    sys.modules["tkinter.ttk"] = ttk_mod
    sys.modules["tkinter.messagebox"] = msg_mod
    sys.modules["tkinter.filedialog"] = fd_mod
    sys.modules["tkinter.colorchooser"] = cc_mod
    sys.modules["tkinter.scrolledtext"] = st_mod
    sys.modules["tkinter.font"] = font_mod
    sys.modules["tkinter.constants"] = const_mod

    # CustomTkinter module
    ctk_mod = types.ModuleType("customtkinter")
    for k, v in constants.items():
        setattr(ctk_mod, k, v)
    ctk_mod.Variable = Variable
    ctk_mod.StringVar = StringVar
    ctk_mod.IntVar = IntVar
    ctk_mod.DoubleVar = DoubleVar
    ctk_mod.BooleanVar = BooleanVar

    def _ctk_root(*a, **kw):
        _SCENE.set_framework("py-customtkinter", "CustomTkinter (Modern Dark/Light UI)", "ctk", dark=True, accent="#10B981")
        return _TkRoot(*a, **kw)

    ctk_mod.set_appearance_mode = lambda mode: setattr(_SCENE, "dark_mode", str(mode).lower() != "light")
    ctk_mod.set_default_color_theme = lambda theme: setattr(_SCENE, "accent_color", "#2563EB" if "blue" in str(theme).lower() else "#10B981")
    ctk_mod.set_widget_scaling = lambda *a: None
    ctk_mod.set_window_scaling = lambda *a: None
    ctk_mod.CTk = _ctk_root
    ctk_mod.CTkToplevel = _ctk_root
    ctk_mod.CTkFrame = tk_mod.Frame
    ctk_mod.CTkScrollableFrame = tk_mod.Frame
    ctk_mod.CTkTabview = tk_mod.Frame
    ctk_mod.CTkLabel = tk_mod.Label
    ctk_mod.CTkButton = tk_mod.Button
    ctk_mod.CTkEntry = tk_mod.Entry
    ctk_mod.CTkTextbox = tk_mod.Text
    ctk_mod.CTkSlider = tk_mod.Scale
    ctk_mod.CTkSwitch = tk_mod.Checkbutton
    ctk_mod.CTkCheckBox = tk_mod.Checkbutton
    ctk_mod.CTkRadioButton = tk_mod.Radiobutton
    ctk_mod.CTkProgressBar = ttk_mod.Progressbar
    ctk_mod.CTkOptionMenu = ttk_mod.Combobox
    ctk_mod.CTkComboBox = ttk_mod.Combobox
    ctk_mod.CTkSegmentedButton = ttk_mod.Combobox
    ctk_mod.CTkCanvas = _TkCanvas
    ctk_mod.CTkFont = font_mod.Font
    ctk_mod.CTkImage = tk_mod.PhotoImage
    ctk_mod.CTkInputDialog = lambda **kw: types.SimpleNamespace(get_input=lambda: "CustomTkinter Input")
    sys.modules["customtkinter"] = ctk_mod


# ============================================================================
# 2. KIVY & KIVYMD ENGINE
# ============================================================================
class _KivyWidget(_BaseTkWidget):
    def __init__(self, wtype="label", **kwargs):
        _SCENE.set_framework("py-kivymd", "Kivy & KivyMD (OpenGL ES 2 Touch UI)", "kivy", dark=True, accent="#6366F1")
        on_press = kwargs.pop("on_press", kwargs.pop("on_release", None))
        if callable(on_press):
            kwargs["command"] = lambda: on_press(self)
        if "hint_text" in kwargs and "placeholder_text" not in kwargs:
            kwargs["placeholder_text"] = kwargs["hint_text"]
        if "active" in kwargs and "value" not in kwargs:
            kwargs["value"] = kwargs["active"]
        super().__init__(None, wtype=wtype, **kwargs)
        self.canvas = types.SimpleNamespace(before=self, after=self, add=lambda *a: None, clear=lambda: None)

    @property
    def text(self):
        return self._text if self._wtype in ("label", "header", "button") else str(self.get())

    @text.setter
    def text(self, val):
        if self._wtype in ("label", "header", "button"):
            self.configure(text=str(val))
        else:
            self.set(str(val))

    @property
    def value(self):
        try:
            return float(self.get())
        except Exception:
            return 0.0

    @value.setter
    def value(self, val):
        self.set(val)

    @property
    def active(self):
        return bool(self.get())

    @active.setter
    def active(self, val):
        self.set(bool(val))

    def add_widget(self, widget, *args, **kwargs):
        return self

    def remove_widget(self, widget):
        pass

    def bind(self, **kwargs):
        for k, cb in kwargs.items():
            if callable(cb):
                _SCENE.callbacks[self._id] = lambda c=cb: c(self, self.get())


class _KivyApp:
    def __init__(self, **kwargs):
        self.title = "Kivy / KivyMD Touch App"
        self.theme_cls = types.SimpleNamespace(theme_style="Dark", primary_palette="Indigo", accent_palette="Teal")
        self.root = None

    def build(self):
        return None

    def run(self):
        _SCENE.set_framework("py-kivymd", "Kivy & KivyMD (OpenGL ES 2 Touch UI)", "kivy", dark=True, accent="#6366F1")
        self.root = self.build()
        if self.title:
            _SCENE.window_title = str(self.title)
        _SCENE.run_event_cycle()

    def stop(self):
        pass


def _build_kivy_modules():
    kivy_mod = types.ModuleType("kivy")
    kivy_mod.require = lambda *a: None
    kivy_app = types.ModuleType("kivy.app")
    kivy_app.App = _KivyApp

    kivy_uix = types.ModuleType("kivy.uix")
    kivy_widget = types.ModuleType("kivy.uix.widget")
    kivy_widget.Widget = lambda **kw: _KivyWidget("container", **kw)

    layouts = ["boxlayout", "gridlayout", "floatlayout", "relativelayout", "anchorlayout", "stacklayout", "pagelayout", "scrollview", "screenmanager"]
    for lname in layouts:
        m = types.ModuleType(f"kivy.uix.{lname}")
        cls_name = "".join(part.capitalize() for part in lname.replace("layout", "_layout").replace("view", "_view").replace("manager", "_manager").split("_"))
        setattr(m, cls_name, lambda **kw: _KivyWidget("container", **kw))
        if lname == "screenmanager":
            setattr(m, "Screen", lambda **kw: _KivyWidget("container", **kw))
        sys.modules[f"kivy.uix.{lname}"] = m

    def _reg_kivy_w(submod, cls_name, wtype):
        m = types.ModuleType(f"kivy.uix.{submod}")
        setattr(m, cls_name, lambda **kw: _KivyWidget(wtype, **kw))
        sys.modules[f"kivy.uix.{submod}"] = m

    _reg_kivy_w("label", "Label", "label")
    _reg_kivy_w("button", "Button", "button")
    _reg_kivy_w("textinput", "TextInput", "input")
    _reg_kivy_w("slider", "Slider", "slider")
    _reg_kivy_w("switch", "Switch", "switch")
    _reg_kivy_w("checkbox", "CheckBox", "switch")
    _reg_kivy_w("progressbar", "ProgressBar", "progress")
    _reg_kivy_w("spinner", "Spinner", "select")
    _reg_kivy_w("popup", "Popup", "container")

    kivy_lang = types.ModuleType("kivy.lang")
    kivy_lang.Builder = types.SimpleNamespace(load_string=lambda s: _KivyWidget("container"), load_file=lambda f: _KivyWidget("container"))
    kivy_props = types.ModuleType("kivy.properties")
    for p in ["StringProperty", "NumericProperty", "BooleanProperty", "ListProperty", "ObjectProperty", "DictProperty"]:
        setattr(kivy_props, p, lambda default=None, **kw: default)

    kivy_clock = types.ModuleType("kivy.clock")
    kivy_clock.Clock = types.SimpleNamespace(schedule_interval=lambda cb, dt: None, schedule_once=lambda cb, dt=0: None)
    kivy_win = types.ModuleType("kivy.core.window")
    kivy_win.Window = types.SimpleNamespace(size=(540, 480), clearcolor=(0.06, 0.09, 0.16, 1))
    kivy_gfx = types.ModuleType("kivy.graphics")
    kivy_gfx.Color = lambda *a, **kw: None
    kivy_gfx.Rectangle = lambda **kw: None
    kivy_gfx.Line = lambda **kw: None
    kivy_gfx.Ellipse = lambda **kw: None

    sys.modules["kivy"] = kivy_mod
    sys.modules["kivy.app"] = kivy_app
    sys.modules["kivy.uix"] = kivy_uix
    sys.modules["kivy.uix.widget"] = kivy_widget
    sys.modules["kivy.lang"] = kivy_lang
    sys.modules["kivy.properties"] = kivy_props
    sys.modules["kivy.clock"] = kivy_clock
    sys.modules["kivy.core"] = types.ModuleType("kivy.core")
    sys.modules["kivy.core.window"] = kivy_win
    sys.modules["kivy.graphics"] = kivy_gfx

    # KivyMD
    kmd_mod = types.ModuleType("kivymd")
    kmd_app = types.ModuleType("kivymd.app")
    kmd_app.MDApp = _KivyApp
    kmd_uix = types.ModuleType("kivymd.uix")

    def _reg_kmd(submod, classes_map):
        m = types.ModuleType(f"kivymd.uix.{submod}")
        for cname, wtype in classes_map.items():
            setattr(m, cname, lambda _wt=wtype, **kw: _KivyWidget(_wt, **kw))
        sys.modules[f"kivymd.uix.{submod}"] = m

    _reg_kmd("screen", {"MDScreen": "container", "Screen": "container"})
    _reg_kmd("boxlayout", {"MDBoxLayout": "container"})
    _reg_kmd("gridlayout", {"MDGridLayout": "container"})
    _reg_kmd("floatlayout", {"MDFloatLayout": "container"})
    _reg_kmd("card", {"MDCard": "container"})
    _reg_kmd("toolbar", {"MDTopAppBar": "header", "MDBottomAppBar": "container"})
    _reg_kmd("label", {"MDLabel": "label", "MDIcon": "label"})
    _reg_kmd("button", {
        "MDRaisedButton": "button",
        "MDFlatButton": "button",
        "MDRectangleFlatButton": "button",
        "MDFillRoundFlatButton": "button",
        "MDIconButton": "button",
        "MDFloatingActionButton": "button"
    })
    _reg_kmd("textfield", {"MDTextField": "input"})
    _reg_kmd("slider", {"MDSlider": "slider"})
    _reg_kmd("selectioncontrol", {"MDSwitch": "switch", "MDCheckbox": "switch"})
    _reg_kmd("progressbar", {"MDProgressBar": "progress"})
    _reg_kmd("dialog", {"MDDialog": "container"})
    _reg_kmd("list", {"MDList": "container", "OneLineListItem": "label", "TwoLineListItem": "label"})

    sys.modules["kivymd"] = kmd_mod
    sys.modules["kivymd.app"] = kmd_app
    sys.modules["kivymd.uix"] = kmd_uix


# ============================================================================
# 3. PYGAME 2D ENGINE (Captures real draw calls & steps game loop cleanly)
# ============================================================================
def _color_to_css(c):
    if isinstance(c, str):
        return c
    if isinstance(c, (tuple, list)) and len(c) >= 3:
        return f"rgb({int(c[0])}, {int(c[1])}, {int(c[2])})"
    return "#10B981"

class _PygameRect:
    def __init__(self, x=0, y=0, w=10, h=10):
        if isinstance(x, (tuple, list)) and len(x) == 4:
            self.x, self.y, self.w, self.h = [float(v) for v in x]
        elif isinstance(x, _PygameRect):
            self.x, self.y, self.w, self.h = x.x, x.y, x.w, x.h
        else:
            self.x, self.y, self.w, self.h = float(x), float(y), float(w), float(h)
        self.width = self.w
        self.height = self.h
        self.left = self.x
        self.top = self.y
        self.right = self.x + self.w
        self.bottom = self.y + self.h
        self.centerx = self.x + self.w / 2
        self.centery = self.y + self.h / 2
        self.center = (self.centerx, self.centery)

    def colliderect(self, other):
        return not (self.right < other.left or self.left > other.right or self.bottom < other.top or self.top > other.bottom)

    def collidepoint(self, x, y=None):
        if isinstance(x, (tuple, list)):
            x, y = x[0], x[1]
        return self.left <= x <= self.right and self.top <= y <= self.bottom

    def move(self, dx, dy):
        return _PygameRect(self.x + dx, self.y + dy, self.w, self.h)

    def inflate(self, dx, dy):
        return _PygameRect(self.x - dx / 2, self.y - dy / 2, self.w + dx, self.h + dy)


class _PygameSurface:
    def __init__(self, size=(500, 260), is_display=False):
        self.width = int(size[0])
        self.height = int(size[1])
        self.is_display = is_display
        self._text_label = None
        self._text_color = "#F8FAFC"

    def fill(self, color, rect=None):
        if self.is_display:
            if rect is None:
                # Keep only the latest full-screen clear so multi-frame loops don't bloat command list
                _SCENE.canvas_commands.clear()
                _SCENE.add_canvas_cmd({"op": "clear", "color": _color_to_css(color)})
            else:
                r = _PygameRect(rect)
                _SCENE.add_canvas_cmd({"op": "rect", "x": r.x, "y": r.y, "w": r.w, "h": r.h, "fill": _color_to_css(color), "stroke": ""})

    def blit(self, source, dest, *args):
        if isinstance(dest, _PygameRect):
            x, y = dest.x, dest.y
        elif isinstance(dest, (tuple, list)) and len(dest) >= 2:
            x, y = float(dest[0]), float(dest[1])
        else:
            x, y = 16.0, 24.0
        if hasattr(source, "_text_label") and source._text_label:
            _SCENE.add_canvas_cmd({
                "op": "text",
                "x": x,
                "y": y + 14,
                "text": str(source._text_label),
                "color": source._text_color
            })
        else:
            _SCENE.add_canvas_cmd({
                "op": "rect",
                "x": x,
                "y": y,
                "w": getattr(source, "width", 32),
                "h": getattr(source, "height", 32),
                "fill": "#38BDF8",
                "stroke": "#F8FAFC"
            })

    def get_width(self):
        return self.width
    def get_height(self):
        return self.height
    def get_size(self):
        return (self.width, self.height)
    def get_rect(self, **kwargs):
        r = _PygameRect(0, 0, self.width, self.height)
        if "center" in kwargs:
            cx, cy = kwargs["center"]
            r = _PygameRect(cx - self.width / 2, cy - self.height / 2, self.width, self.height)
        elif "topleft" in kwargs:
            tx, ty = kwargs["topleft"]
            r = _PygameRect(tx, ty, self.width, self.height)
        return r
    def convert(self):
        return self
    def convert_alpha(self):
        return self
    def set_colorkey(self, *a):
        pass


def _build_pygame_modules():
    pg = types.ModuleType("pygame")
    pg.QUIT = 256
    pg.KEYDOWN = 768
    pg.KEYUP = 769
    pg.MOUSEBUTTONDOWN = 1025
    pg.MOUSEBUTTONUP = 1026
    pg.MOUSEMOTION = 1024
    pg.K_SPACE = 32
    pg.K_RETURN = 13
    pg.K_ESCAPE = 27
    pg.K_LEFT = 1073741904
    pg.K_RIGHT = 1073741903
    pg.K_UP = 1073741906
    pg.K_DOWN = 1073741905
    pg.K_w = ord("w")
    pg.K_a = ord("a")
    pg.K_s = ord("s")
    pg.K_d = ord("d")

    _frame_state = {"frames": 0, "max_frames": 3}

    def _pg_init():
        _SCENE.set_framework("py-pygame", "Pygame 2D Hardware Canvas Engine", "flutter-material", dark=True, accent="#06B6D4")
        _SCENE.has_canvas = True
        return (6, 0)

    pg.init = _pg_init
    pg.quit = lambda: None
    pg.Surface = _PygameSurface
    pg.Rect = _PygameRect
    pg.Color = lambda *a: _color_to_css(a[0] if len(a) == 1 else a)

    # pygame.display
    disp = types.ModuleType("pygame.display")
    def _set_mode(size=(500, 260), *a, **kw):
        _SCENE.set_framework("py-pygame", "Pygame 2D Hardware Canvas Engine", "flutter-material", dark=True, accent="#06B6D4")
        _SCENE.canvas_width = int(size[0])
        _SCENE.canvas_height = int(size[1])
        _SCENE.has_canvas = True
        return _PygameSurface(size, is_display=True)

    def _set_caption(title, *a):
        _SCENE.window_title = str(title)

    def _flip_or_update(*a):
        _frame_state["frames"] += 1

    disp.init = lambda: None
    disp.set_mode = _set_mode
    disp.set_caption = _set_caption
    disp.flip = _flip_or_update
    disp.update = _flip_or_update
    disp.get_surface = lambda: _PygameSurface((_SCENE.canvas_width, _SCENE.canvas_height), is_display=True)

    # pygame.draw
    draw = types.ModuleType("pygame.draw")
    def _draw_rect(surface, color, rect, width=0, border_radius=0):
        r = _PygameRect(rect)
        _SCENE.add_canvas_cmd({
            "op": "rect",
            "x": r.x,
            "y": r.y,
            "w": r.w,
            "h": r.h,
            "fill": _color_to_css(color) if width == 0 else "",
            "stroke": _color_to_css(color) if width > 0 else "",
            "width": float(width or 1)
        })
        return r

    def _draw_circle(surface, color, center, radius, width=0):
        cx, cy = float(center[0]), float(center[1])
        rad = float(radius)
        _SCENE.add_canvas_cmd({
            "op": "ellipse",
            "cx": cx,
            "cy": cy,
            "rx": rad,
            "ry": rad,
            "fill": _color_to_css(color) if width == 0 else "",
            "stroke": _color_to_css(color) if width > 0 else "",
            "width": float(width or 1.5)
        })
        return _PygameRect(cx - rad, cy - rad, rad * 2, rad * 2)

    def _draw_line(surface, color, start_pos, end_pos, width=1):
        _SCENE.add_canvas_cmd({
            "op": "line",
            "points": [float(start_pos[0]), float(start_pos[1]), float(end_pos[0]), float(end_pos[1])],
            "color": _color_to_css(color),
            "width": float(width)
        })

    def _draw_polygon(surface, color, points, width=0):
        flat = []
        for p in points:
            flat.extend([float(p[0]), float(p[1])])
        _SCENE.add_canvas_cmd({
            "op": "polygon",
            "points": flat,
            "fill": _color_to_css(color) if width == 0 else "",
            "stroke": _color_to_css(color),
            "width": float(width or 1.5)
        })

    def _draw_ellipse(surface, color, rect, width=0):
        r = _PygameRect(rect)
        _SCENE.add_canvas_cmd({
            "op": "ellipse",
            "cx": r.centerx,
            "cy": r.centery,
            "rx": r.w / 2.0,
            "ry": r.h / 2.0,
            "fill": _color_to_css(color) if width == 0 else "",
            "stroke": _color_to_css(color) if width > 0 else "",
            "width": float(width or 1.5)
        })

    draw.rect = _draw_rect
    draw.circle = _draw_circle
    draw.line = _draw_line
    draw.lines = lambda surf, col, closed, pts, w=1: _draw_polygon(surf, col, pts, w)
    draw.polygon = _draw_polygon
    draw.ellipse = _draw_ellipse
    draw.arc = _draw_ellipse

    # pygame.font
    font_mod = types.ModuleType("pygame.font")
    class _PgFont:
        def __init__(self, name=None, size=18, bold=False, italic=False):
            self.size = size
        def render(self, text, antialias, color, background=None):
            s = _PygameSurface((len(str(text)) * 9, self.size + 4))
            s._text_label = str(text)
            s._text_color = _color_to_css(color)
            return s
    font_mod.init = lambda: None
    font_mod.Font = _PgFont
    font_mod.SysFont = _PgFont

    # pygame.event
    ev_mod = types.ModuleType("pygame.event")
    def _event_get():
        _frame_state["frames"] += 1
        events = []
        if _CANVAS_CLICK and _frame_state["frames"] == 1:
            pos = (_CANVAS_CLICK.get("x", 120), _CANVAS_CLICK.get("y", 100))
            events.append(types.SimpleNamespace(type=pg.MOUSEBUTTONDOWN, pos=pos, button=1))
        if _frame_state["frames"] >= _frame_state["max_frames"]:
            events.append(types.SimpleNamespace(type=pg.QUIT))
        return events
    ev_mod.get = _event_get
    ev_mod.poll = lambda: types.SimpleNamespace(type=pg.QUIT)

    # pygame.time
    time_mod = types.ModuleType("pygame.time")
    class _PgClock:
        def tick(self, fps=60):
            return 16
        def get_fps(self):
            return 60.0
    time_mod.Clock = _PgClock
    time_mod.get_ticks = lambda: _frame_state["frames"] * 16
    time_mod.delay = lambda ms: None
    time_mod.wait = lambda ms: None

    # pygame.key & pygame.mouse
    key_mod = types.ModuleType("pygame.key")
    key_mod.get_pressed = lambda: {k: False for k in range(512)}
    mouse_mod = types.ModuleType("pygame.mouse")
    mouse_mod.get_pos = lambda: (int(_CANVAS_CLICK.get("x", 240)), int(_CANVAS_CLICK.get("y", 120))) if _CANVAS_CLICK else (240, 120)
    mouse_mod.get_pressed = lambda: (False, False, False)

    # pygame.math & sprite
    math_mod = types.ModuleType("pygame.math")
    class _Vec2:
        def __init__(self, x=0.0, y=0.0):
            if isinstance(x, (tuple, list)):
                self.x, self.y = float(x[0]), float(x[1])
            else:
                self.x, self.y = float(x), float(y)
        def __iter__(self):
            yield self.x
            yield self.y
        def __add__(self, o):
            return _Vec2(self.x + o.x, self.y + o.y)
        def __sub__(self, o):
            return _Vec2(self.x - o.x, self.y - o.y)
        def __mul__(self, s):
            return _Vec2(self.x * float(s), self.y * float(s))
        def length(self):
            return math.hypot(self.x, self.y)
    math_mod.Vector2 = _Vec2

    sprite_mod = types.ModuleType("pygame.sprite")
    class _Sprite:
        def __init__(self, *groups):
            self.image = None
            self.rect = _PygameRect(0, 0, 32, 32)
            for g in groups:
                if hasattr(g, "add"):
                    g.add(self)
        def update(self, *a, **kw):
            pass
        def kill(self):
            pass
    class _Group(list):
        def add(self, *sprites):
            for s in sprites:
                if s not in self:
                    self.append(s)
        def update(self, *a, **kw):
            for s in list(self):
                s.update(*a, **kw)
        def draw(self, surface):
            for s in list(self):
                if getattr(s, "image", None) and getattr(s, "rect", None):
                    surface.blit(s.image, s.rect)
    sprite_mod.Sprite = _Sprite
    sprite_mod.Group = _Group

    locals_mod = types.ModuleType("pygame.locals")
    for k in dir(pg):
        if k.isupper():
            setattr(locals_mod, k, getattr(pg, k))

    pg.display = disp
    pg.draw = draw
    pg.font = font_mod
    pg.event = ev_mod
    pg.time = time_mod
    pg.key = key_mod
    pg.mouse = mouse_mod
    pg.math = math_mod
    pg.sprite = sprite_mod
    pg.locals = locals_mod
    pg.mixer = types.SimpleNamespace(init=lambda: None, Sound=lambda *a: types.SimpleNamespace(play=lambda: None))
    pg.image = types.SimpleNamespace(load=lambda *a: _PygameSurface((64, 64)))
    pg.transform = types.SimpleNamespace(scale=lambda s, sz: _PygameSurface(sz), rotate=lambda s, ang: s)

    sys.modules["pygame"] = pg
    sys.modules["pygame.display"] = disp
    sys.modules["pygame.draw"] = draw
    sys.modules["pygame.font"] = font_mod
    sys.modules["pygame.event"] = ev_mod
    sys.modules["pygame.time"] = time_mod
    sys.modules["pygame.key"] = key_mod
    sys.modules["pygame.mouse"] = mouse_mod
    sys.modules["pygame.math"] = math_mod
    sys.modules["pygame.sprite"] = sprite_mod
    sys.modules["pygame.locals"] = locals_mod


# ============================================================================
# 4. PYQT6 / PYQT5 / PYSIDE6 / PYSIDE2 ENGINE
# ============================================================================
class _QtSignal:
    def __init__(self, widget):
        self._widget = widget
    def connect(self, slot):
        if callable(slot):
            _SCENE.callbacks[self._widget._id] = slot
    def emit(self, *args):
        cb = _SCENE.callbacks.get(self._widget._id)
        if callable(cb):
            cb(*args)

class _QtWidget(_BaseTkWidget):
    def __init__(self, wtype="label", text="", parent=None, **kwargs):
        _SCENE.set_framework("py-pyqt6", "PyQt6 / Qt6 Widgets (Python 3)", "qt", dark=False, accent="#2563EB")
        super().__init__(parent, wtype=wtype, text=str(text), value=kwargs.get("value", text if wtype == "input" else ""), **kwargs)
        self.clicked = _QtSignal(self)
        self.pressed = _QtSignal(self)
        self.textChanged = _QtSignal(self)
        self.valueChanged = _QtSignal(self)
        self.stateChanged = _QtSignal(self)
        self.toggled = _QtSignal(self)
        self.currentIndexChanged = _QtSignal(self)

    def setWindowTitle(self, title):
        _SCENE.window_title = str(title)
    def resize(self, w, h):
        _SCENE.window_width = int(w)
        _SCENE.window_height = int(h)
    def setFixedSize(self, w, h):
        self.resize(w, h)
    def setGeometry(self, x, y, w, h):
        self.resize(w, h)
    def setText(self, text):
        if self._wtype in ("label", "header", "button"):
            self.configure(text=str(text))
        else:
            self.set(str(text))
    def text(self):
        return str(self.get()) if self._wtype == "input" else str(self._text)
    def setPlaceholderText(self, text):
        self._placeholder = str(text)
        if self._w_dict is not None:
            self._w_dict["placeholder"] = str(text)
    def setValue(self, val):
        if self._id not in _INPUT_VALUES or _SCENE.loop_executed:
            self.set(val)
    def value(self):
        try:
            return int(float(self.get()))
        except Exception:
            return 0
    def setMinimum(self, v):
        self._from = v
        if self._w_dict is not None:
            self._w_dict["min"] = float(v)
    def setMaximum(self, v):
        self._to = v
        if self._w_dict is not None:
            self._w_dict["max"] = float(v)
    def setRange(self, vmin, vmax):
        self.setMinimum(vmin)
        self.setMaximum(vmax)
    def setChecked(self, checked):
        if self._id not in _INPUT_VALUES or _SCENE.loop_executed:
            self.set(bool(checked))
    def isChecked(self):
        return bool(self.get())
    def addItem(self, item):
        self._values.append(str(item))
        if not self._value:
            self._value = str(item)
        if self._w_dict is not None:
            self._sync_to_dict(self._w_dict)
    def addItems(self, items):
        for it in items:
            self.addItem(it)
    def currentText(self):
        return str(self.get())
    def setLayout(self, layout):
        pass
    def setCentralWidget(self, w):
        pass
    def setStyleSheet(self, css):
        pass
    def setFont(self, f):
        pass
    def setAlignment(self, a):
        pass
    def show(self):
        _SCENE.run_event_cycle()
    def close(self):
        pass


class _QtApplication:
    def __init__(self, argv=None):
        _SCENE.set_framework("py-pyqt6", "PyQt6 / Qt6 Widgets (Python 3)", "qt", dark=False, accent="#2563EB")
    def setStyle(self, s):
        pass
    def setApplicationName(self, name):
        _SCENE.window_title = str(name)
    def exec(self):
        _SCENE.run_event_cycle()
        return 0
    exec_ = exec


class _QtLayout:
    def __init__(self, *a, **kw):
        pass
    def addWidget(self, *a, **kw):
        pass
    def addLayout(self, *a, **kw):
        pass
    def addRow(self, label, field=None):
        if isinstance(label, str):
            _QtWidget("label", label)
    def addStretch(self, *a):
        pass
    def setContentsMargins(self, *a):
        pass
    def setSpacing(self, *a):
        pass


def _build_qt_modules():
    for pkg_name in ["PyQt6", "PyQt5", "PySide6", "PySide2"]:
        root_mod = types.ModuleType(pkg_name)
        qw = types.ModuleType(f"{pkg_name}.QtWidgets")
        qc = types.ModuleType(f"{pkg_name}.QtCore")
        qg = types.ModuleType(f"{pkg_name}.QtGui")

        qw.QApplication = _QtApplication
        qw.QMainWindow = lambda *a, **kw: _QtWidget("root", "")
        qw.QWidget = lambda *a, **kw: _QtWidget("container", "")
        qw.QDialog = lambda *a, **kw: _QtWidget("root", "")
        qw.QGroupBox = lambda title="", *a, **kw: _QtWidget("header", title)
        qw.QTabWidget = lambda *a, **kw: _QtWidget("container", "")
        qw.QFrame = lambda *a, **kw: _QtWidget("container", "")
        qw.QVBoxLayout = _QtLayout
        qw.QHBoxLayout = _QtLayout
        qw.QGridLayout = _QtLayout
        qw.QFormLayout = _QtLayout

        qw.QLabel = lambda text="", *a, **kw: _QtWidget("label", text)
        qw.QPushButton = lambda text="Button", *a, **kw: _QtWidget("button", text)
        qw.QToolButton = lambda text="Tool", *a, **kw: _QtWidget("button", text)
        qw.QLineEdit = lambda text="", *a, **kw: _QtWidget("input", text)
        qw.QTextEdit = lambda text="", *a, **kw: _QtWidget("input", text)
        qw.QPlainTextEdit = lambda text="", *a, **kw: _QtWidget("input", text)
        qw.QSlider = lambda *a, **kw: _QtWidget("slider", "Qt Slider", value=50)
        qw.QSpinBox = lambda *a, **kw: _QtWidget("slider", "Qt SpinBox", value=25)
        qw.QDoubleSpinBox = lambda *a, **kw: _QtWidget("slider", "Qt DoubleSpinBox", value=25.0)
        qw.QDial = lambda *a, **kw: _QtWidget("slider", "Qt Dial", value=60)
        qw.QCheckBox = lambda text="Option", *a, **kw: _QtWidget("switch", text, value=True)
        qw.QRadioButton = lambda text="Option", *a, **kw: _QtWidget("switch", text, value=False)
        qw.QComboBox = lambda *a, **kw: _QtWidget("select", "ComboBox")
        qw.QListWidget = lambda *a, **kw: _QtWidget("select", "ListWidget")
        qw.QProgressBar = lambda *a, **kw: _QtWidget("progress", "Progress", value=75)
        qw.QTableWidget = lambda *a, **kw: _QtWidget("table", "Qt Table")
        qw.QTableWidgetItem = lambda text="": str(text)
        qw.QMessageBox = types.SimpleNamespace(
            information=lambda parent, title, msg: _SCENE.add_dialog("info", title, msg),
            warning=lambda parent, title, msg: _SCENE.add_dialog("warning", title, msg),
            critical=lambda parent, title, msg: _SCENE.add_dialog("error", title, msg),
            question=lambda parent, title, msg: (_SCENE.add_dialog("question", title, msg), 16384)[1],
            StandardButton=types.SimpleNamespace(Yes=16384, No=65536, Ok=1024, Cancel=4194304)
        )

        qc.Qt = types.SimpleNamespace(
            Orientation=types.SimpleNamespace(Horizontal=1, Vertical=2),
            AlignmentFlag=types.SimpleNamespace(AlignCenter=4, AlignLeft=1, AlignRight=2),
            Horizontal=1, Vertical=2, AlignCenter=4, AlignLeft=1, AlignRight=2
        )
        qc.pyqtSignal = lambda *a: _QtSignal(_QtWidget("container"))
        qc.Signal = qc.pyqtSignal
        qc.pyqtSlot = lambda *a: (lambda f: f)
        qc.Slot = qc.pyqtSlot
        qc.QTimer = lambda *a: types.SimpleNamespace(timeout=types.SimpleNamespace(connect=lambda cb: None), start=lambda ms: None, stop=lambda: None)

        qg.QFont = lambda *a, **kw: None
        qg.QIcon = lambda *a, **kw: None
        qg.QColor = lambda *a, **kw: None
        qg.QPalette = lambda *a, **kw: None
        qg.QAction = lambda text="", *a, **kw: _QtWidget("button", text)

        root_mod.QtWidgets = qw
        root_mod.QtCore = qc
        root_mod.QtGui = qg
        sys.modules[pkg_name] = root_mod
        sys.modules[f"{pkg_name}.QtWidgets"] = qw
        sys.modules[f"{pkg_name}.QtCore"] = qc
        sys.modules[f"{pkg_name}.QtGui"] = qg


# ============================================================================
# 5. WXPYTHON (wx) ENGINE
# ============================================================================
def _build_wx_module():
    wx = types.ModuleType("wx")
    wx.ID_ANY = -1
    wx.DEFAULT_FRAME_STYLE = 1
    wx.VERTICAL = 4
    wx.HORIZONTAL = 8
    wx.EXPAND = 16
    wx.ALL = 32
    wx.ALIGN_CENTER = 64
    wx.EVT_BUTTON = "EVT_BUTTON"
    wx.EVT_SLIDER = "EVT_SLIDER"
    wx.EVT_TEXT = "EVT_TEXT"
    wx.EVT_CHECKBOX = "EVT_CHECKBOX"
    wx.EVT_CHOICE = "EVT_CHOICE"

    class _WxApp:
        def __init__(self, *a, **kw):
            _SCENE.set_framework("py-wxpython", "wxPython Native Desktop GUI", "wx", dark=False, accent="#0284C7")
        def MainLoop(self):
            _SCENE.run_event_cycle()

    class _WxWidget(_BaseTkWidget):
        def __init__(self, parent=None, wtype="label", label="", value="", choices=None, **kwargs):
            _SCENE.set_framework("py-wxpython", "wxPython Native Desktop GUI", "wx", dark=False, accent="#0284C7")
            super().__init__(parent, wtype=wtype, text=str(label), value=value, values=choices or [], **kwargs)

        def Bind(self, event, handler, source=None):
            target = source if source is not None else self
            if callable(handler):
                _SCENE.callbacks[target._id] = lambda: handler(types.SimpleNamespace(GetEventObject=lambda: target, GetString=lambda: str(target.get()), GetInt=lambda: int(float(target.get() or 0))))

        def SetValue(self, val):
            self.set(val)
        def GetValue(self):
            return self.get()
        def SetLabel(self, text):
            self.configure(text=str(text))
        def GetLabel(self):
            return self._text
        def SetSizer(self, s):
            pass
        def Show(self, show=True):
            pass
        def Centre(self):
            pass
        def Center(self):
            pass

    class _WxFrame(_WxWidget):
        def __init__(self, parent=None, id=-1, title="wxPython Window", size=(560, 440), **kw):
            super().__init__(parent, wtype="root", label=title)
            _SCENE.window_title = str(title)
            if isinstance(size, (tuple, list)) and len(size) == 2:
                _SCENE.window_width, _SCENE.window_height = int(size[0]), int(size[1])

    class _WxSizer:
        def __init__(self, orient=4):
            pass
        def Add(self, *a, **kw):
            pass
        def AddSpacer(self, *a):
            pass

    wx.App = _WxApp
    wx.Frame = _WxFrame
    wx.Panel = lambda parent=None, *a, **kw: _WxWidget(parent, "container")
    wx.BoxSizer = _WxSizer
    wx.GridSizer = lambda *a, **kw: _WxSizer()
    wx.FlexGridSizer = lambda *a, **kw: _WxSizer()
    wx.StaticText = lambda parent=None, id=-1, label="", *a, **kw: _WxWidget(parent, "label", label=label)
    wx.Button = lambda parent=None, id=-1, label="Button", *a, **kw: _WxWidget(parent, "button", label=label)
    wx.TextCtrl = lambda parent=None, id=-1, value="", *a, **kw: _WxWidget(parent, "input", label="Text Input", value=value)
    wx.Slider = lambda parent=None, id=-1, value=50, minValue=0, maxValue=100, *a, **kw: _WxWidget(parent, "slider", label="wx.Slider", value=value, from_=minValue, to=maxValue)
    wx.CheckBox = lambda parent=None, id=-1, label="CheckBox", *a, **kw: _WxWidget(parent, "switch", label=label, value=True)
    wx.RadioButton = lambda parent=None, id=-1, label="RadioButton", *a, **kw: _WxWidget(parent, "switch", label=label, value=False)
    wx.Gauge = lambda parent=None, id=-1, range=100, *a, **kw: _WxWidget(parent, "progress", label="wx.Gauge", value=70, to=range)
    wx.Choice = lambda parent=None, id=-1, choices=None, *a, **kw: _WxWidget(parent, "select", label="wx.Choice", choices=choices or [])
    wx.ComboBox = lambda parent=None, id=-1, value="", choices=None, *a, **kw: _WxWidget(parent, "select", label="wx.ComboBox", value=value, choices=choices or [])
    wx.MessageBox = lambda message, caption="wxPython Message", *a, **kw: _SCENE.add_dialog("info", caption, message)

    sys.modules["wx"] = wx


# ============================================================================
# 6. FLET (Flutter for Python) ENGINE
# ============================================================================
def _build_flet_module():
    ft = types.ModuleType("flet")

    class _FtControl(_BaseTkWidget):
        def __init__(self, wtype="label", label="", value="", on_click=None, on_change=None, options=None, **kw):
            _SCENE.set_framework("py-flet", "Flet (Flutter for Python Reactive UI)", "flutter-material", dark=True, accent="#06B6D4")
            cb = on_click or on_change
            wrapped_cb = (lambda: cb(types.SimpleNamespace(control=self, data=self.value))) if callable(cb) else None
            super().__init__(None, wtype=wtype, text=str(label), value=value, values=options or [], command=wrapped_cb, **kw)

        @property
        def value(self):
            return self._text if self._wtype in ("label", "header") else self.get()

        @value.setter
        def value(self, v):
            if self._wtype in ("label", "header"):
                self.configure(text=str(v))
            else:
                self.set(v)

        def update(self):
            if self._w_dict is not None:
                self._sync_to_dict(self._w_dict)

    class _FtPage:
        def __init__(self):
            self.title = "Flet Application"
            self.theme_mode = "dark"
            self.controls = []
        def add(self, *controls):
            if self.title:
                _SCENE.window_title = str(self.title)
            self.controls.extend(controls)
        def update(self):
            if self.title:
                _SCENE.window_title = str(self.title)

    def _ft_app(target=None, *a, **kw):
        _SCENE.set_framework("py-flet", "Flet (Flutter for Python Reactive UI)", "flutter-material", dark=True, accent="#06B6D4")
        if callable(target):
            page = _FtPage()
            target(page)
            if page.title:
                _SCENE.window_title = str(page.title)
        _SCENE.run_event_cycle()

    ft.Page = _FtPage
    ft.app = _ft_app
    ft.run = _ft_app
    ft.Text = lambda value="", **kw: _FtControl("label", label=value, value=value, **kw)
    ft.AppBar = lambda title=None, **kw: _FtControl("header", label=getattr(title, "_text", str(title or "Flet App")))
    ft.ElevatedButton = lambda text="Button", on_click=None, **kw: _FtControl("button", label=text, on_click=on_click, **kw)
    ft.FilledButton = ft.ElevatedButton
    ft.OutlinedButton = ft.ElevatedButton
    ft.TextButton = ft.ElevatedButton
    ft.FloatingActionButton = lambda text="Action", on_click=None, **kw: _FtControl("button", label=text, on_click=on_click, **kw)
    ft.TextField = lambda label="Input", value="", hint_text="", on_change=None, **kw: _FtControl("input", label=label, value=value, placeholder_text=hint_text, on_change=on_change)
    ft.Slider = lambda min=0, max=100, value=50, label="Slider", on_change=None, **kw: _FtControl("slider", label=label, value=value, from_=min, to=max, on_change=on_change)
    ft.Switch = lambda label="Switch", value=True, on_change=None, **kw: _FtControl("switch", label=label, value=value, on_change=on_change)
    ft.Checkbox = lambda label="Checkbox", value=True, on_change=None, **kw: _FtControl("switch", label=label, value=value, on_change=on_change)
    ft.ProgressBar = lambda value=0.75, **kw: _FtControl("progress", label="Progress", value=round(float(value) * 100) if float(value) <= 1.0 else float(value))
    ft.Dropdown = lambda label="Select", value="", options=None, **kw: _FtControl("select", label=label, value=value, options=[getattr(o, "key", str(o)) for o in (options or [])])
    ft.dropdown = types.SimpleNamespace(Option=lambda key, text=None: types.SimpleNamespace(key=str(text or key)))
    ft.Column = lambda controls=None, **kw: controls or []
    ft.Row = lambda controls=None, **kw: controls or []
    ft.Container = lambda content=None, **kw: content
    ft.Card = lambda content=None, **kw: content
    ft.ThemeMode = types.SimpleNamespace(DARK="dark", LIGHT="light", SYSTEM="system")
    ft.Colors = types.SimpleNamespace(BLUE="blue", GREEN="green", TEAL="teal", WHITE="white")
    ft.Icons = types.SimpleNamespace(ADD="add", CHECK="check", PLAY_ARROW="play", SETTINGS="settings")

    sys.modules["flet"] = ft


# ============================================================================
# 7. PYSIMPLEGUI / FREESIMPLEGUI ENGINE
# ============================================================================
def _build_pysimplegui_module():
    sg = types.ModuleType("PySimpleGUI")
    sg.WIN_CLOSED = None
    sg.WINDOW_CLOSED = None

    def _sg_elem(wtype, label="", default_val="", key=None, values=None, min_v=0, max_v=100):
        w = _BaseTkWidget(None, wtype=wtype, text=str(label), value=default_val, values=values or [], from_=min_v, to=max_v)
        w._sg_key = key if key is not None else label
        return w

    class _SgWindow:
        def __init__(self, title, layout=None, **kw):
            _SCENE.set_framework("py-pysimplegui", "PySimpleGUI Rapid Desktop UI", "tk", dark=True, accent="#0D9488")
            _SCENE.window_title = str(title)
            self._read_count = 0
            self._key_map = {}
            for w_id, obj in list(_SCENE.widget_map.items()):
                k = getattr(obj, "_sg_key", None)
                if k is not None:
                    self._key_map[k] = obj

        def read(self, timeout=None):
            self._read_count += 1
            if self._read_count == 1:
                _SCENE.run_event_cycle()
                values_dict = {}
                for idx, (wid, obj) in enumerate(_SCENE.widget_map.items()):
                    k = getattr(obj, "_sg_key", idx)
                    values_dict[k] = obj.get()
                ev = _TRIGGER_LABEL
                if not ev:
                    # Pick first button if user hasn't clicked a specific one yet
                    for w in _SCENE.widgets:
                        if w.get("type") == "button":
                            ev = w.get("label")
                            break
                return ev, values_dict
            return sg.WIN_CLOSED, {}

        def __getitem__(self, key):
            obj = self._key_map.get(key)
            if obj is not None:
                return types.SimpleNamespace(
                    update=lambda value=None, **kw: obj.configure(text=str(value)) if obj._wtype in ("label", "header") else obj.set(value),
                    Update=lambda value=None, **kw: obj.configure(text=str(value)) if obj._wtype in ("label", "header") else obj.set(value),
                    get=obj.get
                )
            return types.SimpleNamespace(update=lambda *a, **kw: None, Update=lambda *a, **kw: None)

        def close(self):
            pass

    sg.theme = lambda name=None: "DarkTeal9"
    sg.Window = _SgWindow
    sg.Text = lambda text="", key=None, **kw: _sg_elem("label", text, text, key)
    sg.T = sg.Text
    sg.Input = lambda default_text="", key=None, **kw: _sg_elem("input", str(key or "Input"), default_text, key)
    sg.InputText = sg.Input
    sg.In = sg.Input
    sg.Multiline = sg.Input
    sg.Button = lambda button_text="Button", key=None, **kw: _sg_elem("button", button_text, "", key or button_text)
    sg.B = sg.Button
    sg.Slider = lambda range=(0, 100), default_value=50, key=None, **kw: _sg_elem("slider", str(key or "Slider"), default_value, key, min_v=range[0], max_v=range[1])
    sg.Checkbox = lambda text="", default=True, key=None, **kw: _sg_elem("switch", text, default, key)
    sg.CB = sg.Checkbox
    sg.Radio = lambda text="", group_id=1, default=False, key=None, **kw: _sg_elem("switch", text, default, key)
    sg.Combo = lambda values, default_value=None, key=None, **kw: _sg_elem("select", str(key or "Select"), default_value or (values[0] if values else ""), key, values=values)
    sg.ProgressBar = lambda max_value=100, key=None, **kw: _sg_elem("progress", str(key or "Progress"), 75, key, max_v=max_value)
    sg.popup = lambda *args, title="PySimpleGUI Popup", **kw: _SCENE.add_dialog("info", title, " ".join(str(a) for a in args))
    sg.popup_error = lambda *args, title="Error", **kw: _SCENE.add_dialog("error", title, " ".join(str(a) for a in args))

    sys.modules["PySimpleGUI"] = sg
    sys.modules["FreeSimpleGUI"] = sg


# ============================================================================
# 8. DEARPYGUI ENGINE
# ============================================================================
def _build_dearpygui_module():
    dpg_pkg = types.ModuleType("dearpygui")
    dpg = types.ModuleType("dearpygui.dearpygui")

    class _DpgContextMgr:
        def __init__(self, label=""):
            if label:
                _SCENE.window_title = str(label)
        def __enter__(self):
            return self
        def __exit__(self, exc_type, exc_val, tb):
            return False

    def _dpg_widget(wtype, label="", default_value="", callback=None, tag=None, min_value=0, max_value=100, items=None, **kw):
        _SCENE.set_framework("py-dearpygui", "DearPyGui GPU Immediate-Mode UI", "imgui", dark=True, accent="#3B82F6")
        w = _BaseTkWidget(
            None,
            wtype=wtype,
            text=str(label or default_value or "Control"),
            value=default_value,
            from_=min_value,
            to=max_value,
            values=items or [],
            command=(lambda: callback(tag or w._id, w.get(), None)) if callable(callback) else None
        )
        if tag is not None:
            _SCENE.widget_map[str(tag)] = w
        return tag or w._id

    dpg.create_context = lambda: _SCENE.set_framework("py-dearpygui", "DearPyGui GPU Immediate-Mode UI", "imgui", dark=True, accent="#3B82F6")
    dpg.destroy_context = lambda: None
    dpg.create_viewport = lambda title="DearPyGui Viewport", width=600, height=480, **kw: setattr(_SCENE, "window_title", str(title))
    dpg.setup_dearpygui = lambda: None
    dpg.show_viewport = lambda: None
    dpg.start_dearpygui = lambda: _SCENE.run_event_cycle()
    dpg.window = lambda label="DearPyGui Window", **kw: _DpgContextMgr(label)
    dpg.group = lambda **kw: _DpgContextMgr()
    dpg.child_window = lambda **kw: _DpgContextMgr()
    dpg.add_text = lambda default_value="", label="", tag=None, **kw: _dpg_widget("label", label=default_value or label, default_value=default_value, tag=tag)
    dpg.add_button = lambda label="Button", callback=None, tag=None, **kw: _dpg_widget("button", label=label, callback=callback, tag=tag)
    dpg.add_input_text = lambda label="Input", default_value="", callback=None, tag=None, **kw: _dpg_widget("input", label=label, default_value=default_value, callback=callback, tag=tag)
    dpg.add_input_int = lambda label="Int", default_value=0, callback=None, tag=None, **kw: _dpg_widget("slider", label=label, default_value=default_value, callback=callback, tag=tag)
    dpg.add_input_float = lambda label="Float", default_value=0.0, callback=None, tag=None, **kw: _dpg_widget("slider", label=label, default_value=default_value, callback=callback, tag=tag)
    dpg.add_slider_float = lambda label="Slider", default_value=50.0, min_value=0.0, max_value=100.0, callback=None, tag=None, **kw: _dpg_widget("slider", label=label, default_value=default_value, min_value=min_value, max_value=max_value, callback=callback, tag=tag)
    dpg.add_slider_int = lambda label="Slider", default_value=50, min_value=0, max_value=100, callback=None, tag=None, **kw: _dpg_widget("slider", label=label, default_value=default_value, min_value=min_value, max_value=max_value, callback=callback, tag=tag)
    dpg.add_checkbox = lambda label="Checkbox", default_value=True, callback=None, tag=None, **kw: _dpg_widget("switch", label=label, default_value=default_value, callback=callback, tag=tag)
    dpg.add_combo = lambda items=None, label="Combo", default_value="", callback=None, tag=None, **kw: _dpg_widget("select", label=label, default_value=default_value or (items[0] if items else ""), items=items, callback=callback, tag=tag)
    dpg.add_progress_bar = lambda label="Progress", default_value=0.75, tag=None, **kw: _dpg_widget("progress", label=label, default_value=round(float(default_value) * 100) if float(default_value) <= 1.0 else float(default_value), tag=tag)

    def _dpg_get_value(tag):
        obj = _SCENE.widget_map.get(str(tag))
        return obj.get() if obj is not None else None

    def _dpg_set_value(tag, val):
        obj = _SCENE.widget_map.get(str(tag))
        if obj is not None:
            if obj._wtype in ("label", "header"):
                obj.configure(text=str(val))
            else:
                obj.set(val)

    dpg.get_value = _dpg_get_value
    dpg.set_value = _dpg_set_value
    dpg_pkg.dearpygui = dpg
    sys.modules["dearpygui"] = dpg_pkg
    sys.modules["dearpygui.dearpygui"] = dpg


# ============================================================================
# 9. PYTHON TURTLE VECTOR GRAPHICS ENGINE
# ============================================================================
class _TurtleInstance:
    def __init__(self):
        _SCENE.set_framework("py-turtle", "Python Turtle Vector Graphics Studio", "tk", dark=True, accent="#10B981")
        _SCENE.has_canvas = True
        _SCENE.canvas_width = 500
        _SCENE.canvas_height = 260
        self._cx = 250.0
        self._cy = 130.0
        self._x = 0.0
        self._y = 0.0
        self._heading = 0.0
        self._pen_down = True
        self._pen_color = "#10B981"
        self._fill_color = "#38BDF8"
        self._pen_width = 2.0
        self._filling = False
        self._fill_pts = []
        if not _SCENE.canvas_commands:
            _SCENE.add_canvas_cmd({"op": "clear", "color": "#070B14"})

    def _to_screen(self, x, y):
        return (round(self._cx + x, 2), round(self._cy - y, 2))

    def forward(self, dist):
        rad = math.radians(self._heading)
        nx = self._x + float(dist) * math.cos(rad)
        ny = self._y + float(dist) * math.sin(rad)
        self.goto(nx, ny)
    fd = forward

    def backward(self, dist):
        self.forward(-float(dist))
    bk = backward
    back = backward

    def right(self, angle):
        self._heading = (self._heading - float(angle)) % 360.0
    rt = right

    def left(self, angle):
        self._heading = (self._heading + float(angle)) % 360.0
    lt = left

    def setheading(self, to_angle):
        self._heading = float(to_angle) % 360.0
    seth = setheading

    def goto(self, x, y=None):
        if isinstance(x, (tuple, list)):
            x, y = x[0], x[1]
        nx, ny = float(x), float(y)
        if self._pen_down and len(_SCENE.canvas_commands) < 600:
            sx1, sy1 = self._to_screen(self._x, self._y)
            sx2, sy2 = self._to_screen(nx, ny)
            _SCENE.add_canvas_cmd({
                "op": "line",
                "points": [sx1, sy1, sx2, sy2],
                "color": self._pen_color,
                "width": self._pen_width
            })
        self._x, self._y = nx, ny
        if self._filling:
            sx, sy = self._to_screen(nx, ny)
            self._fill_pts.extend([sx, sy])
    setpos = goto
    setposition = goto

    def penup(self):
        self._pen_down = False
    pu = penup
    up = penup

    def pendown(self):
        self._pen_down = True
    pd = pendown
    down = pendown

    def width(self, w):
        self._pen_width = float(w)
    pensize = width

    def color(self, *args):
        if len(args) == 1:
            self._pen_color = _color_to_css(args[0])
            self._fill_color = self._pen_color
        elif len(args) >= 2:
            self._pen_color = _color_to_css(args[0])
            self._fill_color = _color_to_css(args[1])

    def pencolor(self, *args):
        if args:
            self._pen_color = _color_to_css(args[0] if len(args) == 1 else args)

    def fillcolor(self, *args):
        if args:
            self._fill_color = _color_to_css(args[0] if len(args) == 1 else args)

    def begin_fill(self):
        self._filling = True
        sx, sy = self._to_screen(self._x, self._y)
        self._fill_pts = [sx, sy]

    def end_fill(self):
        if self._filling and len(self._fill_pts) >= 6:
            _SCENE.add_canvas_cmd({
                "op": "polygon",
                "points": list(self._fill_pts),
                "fill": self._fill_color,
                "stroke": self._pen_color,
                "width": self._pen_width
            })
        self._filling = False
        self._fill_pts = []

    def circle(self, radius, extent=None, steps=None):
        r = abs(float(radius))
        sx, sy = self._to_screen(self._x, self._y + float(radius))
        _SCENE.add_canvas_cmd({
            "op": "ellipse",
            "cx": sx,
            "cy": sy,
            "rx": r,
            "ry": r,
            "fill": self._fill_color if self._filling else "",
            "stroke": self._pen_color,
            "width": self._pen_width
        })

    def dot(self, size=6, *color):
        col = _color_to_css(color[0]) if color else self._pen_color
        sx, sy = self._to_screen(self._x, self._y)
        r = float(size) / 2.0
        _SCENE.add_canvas_cmd({
            "op": "ellipse",
            "cx": sx,
            "cy": sy,
            "rx": r,
            "ry": r,
            "fill": col,
            "stroke": col,
            "width": 1
        })

    def write(self, arg, move=False, align="left", font=("Arial", 12, "normal")):
        sx, sy = self._to_screen(self._x, self._y)
        _SCENE.add_canvas_cmd({
            "op": "text",
            "x": sx,
            "y": sy,
            "text": str(arg),
            "color": self._pen_color
        })

    def speed(self, *a):
        pass
    def hideturtle(self):
        pass
    ht = hideturtle
    def showturtle(self):
        pass
    st = showturtle
    def clear(self):
        _SCENE.canvas_commands.clear()
    def reset(self):
        self._x, self._y, self._heading = 0.0, 0.0, 0.0


def _build_turtle_module():
    t_mod = types.ModuleType("turtle")
    _default_t = [None]

    def _get_t():
        if _default_t[0] is None:
            _default_t[0] = _TurtleInstance()
        return _default_t[0]

    class _Screen:
        def title(self, t):
            _SCENE.window_title = str(t)
        def bgcolor(self, *c):
            if c:
                _SCENE.canvas_commands.insert(0, {"op": "clear", "color": _color_to_css(c[0] if len(c) == 1 else c)})
        def setup(self, width=500, height=260, *a, **kw):
            _SCENE.canvas_width = int(width)
            _SCENE.canvas_height = int(height)
        def tracer(self, *a):
            pass
        def update(self):
            pass
        def exitonclick(self):
            _SCENE.run_event_cycle()
        def mainloop(self):
            _SCENE.run_event_cycle()

    t_mod.Turtle = _TurtleInstance
    t_mod.Pen = _TurtleInstance
    t_mod.Screen = _Screen
    t_mod.done = lambda: _SCENE.run_event_cycle()
    t_mod.mainloop = t_mod.done
    t_mod.exitonclick = t_mod.done
    t_mod.title = lambda s: setattr(_SCENE, "window_title", str(s))
    t_mod.bgcolor = lambda *c: _Screen().bgcolor(*c)
    t_mod.tracer = lambda *a: None
    t_mod.update = lambda: None

    for fn in ["forward", "fd", "backward", "bk", "back", "right", "rt", "left", "lt", "goto", "setpos", "setposition", "setheading", "seth", "penup", "pu", "up", "pendown", "pd", "down", "width", "pensize", "color", "pencolor", "fillcolor", "begin_fill", "end_fill", "circle", "dot", "write", "speed", "hideturtle", "ht", "showturtle", "st", "clear", "reset"]:
        setattr(t_mod, fn, lambda *a, _f=fn, **kw: getattr(_get_t(), _f)(*a, **kw))

    sys.modules["turtle"] = t_mod


# ============================================================================
# 10. TOGA (BeeWare), GRADIO, NICEGUI & STREAMLIT ENGINES
# ============================================================================
def _build_modern_web_and_toga_modules():
    # Toga (BeeWare)
    toga = types.ModuleType("toga")
    toga_style = types.ModuleType("toga.style")
    toga_pack = types.ModuleType("toga.style.pack")
    toga_pack.Pack = lambda **kw: kw
    toga_pack.COLUMN = "column"
    toga_pack.ROW = "row"
    toga_style.Pack = toga_pack.Pack

    class _TogaApp:
        def __init__(self, formal_name="Toga App", app_id="org.beeware.app", **kw):
            _SCENE.set_framework("py-toga", "BeeWare Toga Native GUI", "tk", dark=False, accent="#D97706")
            self.formal_name = formal_name
            _SCENE.window_title = str(formal_name)
        def startup(self):
            pass
        def main_loop(self):
            self.startup()
            _SCENE.run_event_cycle()

    toga.App = _TogaApp
    toga.MainWindow = lambda title="Toga Window", **kw: types.SimpleNamespace(title=title, content=None, show=lambda: None, info_dialog=lambda t, m: _SCENE.add_dialog("info", t, m))
    toga.Box = lambda children=None, **kw: types.SimpleNamespace(add=lambda *c: None)
    toga.Label = lambda text="", **kw: _BaseTkWidget(None, "label", text=text)
    toga.Button = lambda text="Button", on_press=None, **kw: _BaseTkWidget(None, "button", text=text, command=(lambda: on_press(None)) if callable(on_press) else None)
    toga.TextInput = lambda value="", placeholder="", **kw: _BaseTkWidget(None, "input", text="TextInput", value=value, placeholder_text=placeholder)
    toga.Slider = lambda value=50, min=0, max=100, **kw: _BaseTkWidget(None, "slider", text="Toga Slider", value=value, from_=min, to=max)
    toga.Switch = lambda text="Switch", value=True, **kw: _BaseTkWidget(None, "switch", text=text, value=value)
    toga.ProgressBar = lambda value=75, max=100, **kw: _BaseTkWidget(None, "progress", text="Progress", value=value, to=max)

    sys.modules["toga"] = toga
    sys.modules["toga.style"] = toga_style
    sys.modules["toga.style.pack"] = toga_pack

    # Streamlit (st)
    st = types.ModuleType("streamlit")
    st.set_page_config = lambda page_title="Streamlit App", **kw: (_SCENE.set_framework("py-streamlit", "Streamlit Data & ML App", "flutter-material", dark=False, accent="#E11D48"), setattr(_SCENE, "window_title", str(page_title)))
    st.title = lambda text: (_SCENE.set_framework("py-streamlit", "Streamlit Data & ML App", "flutter-material", dark=False, accent="#E11D48"), setattr(_SCENE, "window_title", str(text)), _BaseTkWidget(None, "header", text=text))
    st.header = lambda text: _BaseTkWidget(None, "header", text=text)
    st.subheader = lambda text: _BaseTkWidget(None, "label", text=text)
    st.write = lambda *args: _BaseTkWidget(None, "label", text=" ".join(str(a) for a in args))
    st.markdown = st.write
    st.text_input = lambda label, value="": _BaseTkWidget(None, "input", text=label, value=value).get()
    st.number_input = lambda label, min_value=0, max_value=100, value=50: float(_BaseTkWidget(None, "slider", text=label, value=value, from_=min_value, to=max_value).get() or value)
    st.slider = lambda label, min_value=0, max_value=100, value=50: float(_BaseTkWidget(None, "slider", text=label, value=value, from_=min_value, to=max_value).get() or value)
    st.checkbox = lambda label, value=True: bool(_BaseTkWidget(None, "switch", text=label, value=value).get())
    st.selectbox = lambda label, options: _BaseTkWidget(None, "select", text=label, value=options[0] if options else "", values=options).get()
    st.progress = lambda value: _BaseTkWidget(None, "progress", text="Progress", value=round(float(value) * 100) if float(value) <= 1.0 else float(value))
    st.button = lambda label: (_BaseTkWidget(None, "button", text=label), _TRIGGER_LABEL == label or _TRIGGER_ID is not None)[1]
    st.success = lambda msg: _SCENE.add_dialog("info", "Success", msg)
    st.warning = lambda msg: _SCENE.add_dialog("warning", "Warning", msg)
    st.error = lambda msg: _SCENE.add_dialog("error", "Error", msg)
    sys.modules["streamlit"] = st


# Initialize all Python GUI bridges on startup
_build_tkinter_modules()
_build_kivy_modules()
_build_pygame_modules()
_build_qt_modules()
_build_wx_module()
_build_flet_module()
_build_pysimplegui_module()
_build_dearpygui_module()
_build_turtle_module()
_build_modern_web_and_toga_modules()
`;
