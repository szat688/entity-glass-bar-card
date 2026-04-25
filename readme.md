# 🌡️ Entity Glass Bar Card

A sleek, vertical glass-tube style bar card for Home Assistant. 

This card was originally created for personal use to achieve a specific, clean aesthetic on my own dashboard. I decided to share it with the Home Assistant community, hoping that others will find it useful and enjoy the design as much as I do.

![Preview](preview.png?v=0.15)

---

## ✨ Features
*   **Glassmorphism Design:** Realistic glass effect with highlights, depth, and reflections.
*   **Smart Colors:** Automatic color logic for `temperature`, `humidity`, `battery` and `light` device classes.
*   **Vertical Space Saving:** Uses rotated labels and icons to maximize information density.
*   **Precision Ticks:** Mathematically aligned measurement ticks.
*   **Interactive:** Built-in tap-action to open the "More Info" dialog for each entity.

---

## 🛠️ Installation

### Via HACS (Recommended)
1. Open **HACS** in your Home Assistant.
2. Go to **Frontend**.
3. Click the three dots in the top right and select **Custom repositories**.
4. Paste the URL of this repository and select **Lovelace** as the category.
5. Click **Add** and then **Download**.

---

## 📋 Configuration Options


### Global Options

| Name | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| type | string | **Required** | `custom:entity-glass-bar-card` |
| entities | list | **Required** | List of entities to display. |
| title | string | optional | Title of the card. |
| height | number | 200 | Total height of the bars in pixels. |
| width | number | 40 | Width of each bar in pixels. |
| radius | number | 20 | Border radius for the bars. |
| color | string | null | Global RGB color (e.g., `255, 165, 0`) or CSS variable (e.g., `var(--primary-color)`). |
| step | number | null | Global tick interval (defaults: 5 for temperature, 10 for others). |
| severity | list | optional | Global dynamic color thresholds (see Severity section). |
| show_ticks | boolean | true | Show or hide measurement ticks. |
| show_name | boolean | true | Show or hide entity names. |
| show_icon | boolean | true | Show or hide entity icons. |
| show_value | boolean | true | Show or hide current values. |

### Entity Options

| Name | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| entity | string | **Required** | Entity ID. |
| name | string | optional | Custom name for the entity. |
| icon | string | optional | Custom icon. |
| color | string | optional | Specific RGB color for this entity. |
| min | number | 0 | Minimum value for the bar. |
| max | number | 100 | Maximum value for the bar (Default: 40 for temperature). |
| step | number | null | Custom tick interval for this specific entity. |

### Severity Options
The `severity` option allows you to change the bar color based on its value. It can be defined globally.

| Name | Type | Description |
| :--- | :--- | :--- |
| value | number | The threshold value (color applied if state is less than or equal to this). |
| color | string | RGB color or CSS variable. |

---

## 💡 Example Usage

### Basic Example
```yaml
type: custom:entity-glass-bar-card
title: "Battery Levels"
entities:
  - sensor.phone_battery
  - sensor.tablet_battery
```

### Advanced Example with Severity and Steps
```yaml
type: custom:entity-glass-bar-card
title: "Sensors"
height: 250
step: 10
severity:
  - value: 20
    color: "255, 0, 0"
  - value: 60
    color: "255, 165, 0"
  - value: 100
    color: "76, 175, 80"
entities:
  - entity: sensor.living_room_temp
    name: "Temp"
    max: 40
    step: 5
  - entity: light.living_room_main
    name: "Main Light"
  - entity: sensor.humidity
    name: "Humidity"
```

---

## 🙏 Inspired By
This project was inspired by the following amazing works:
*   [bar-card](https://github.com/custom-cards/bar-card) - For the foundation of bar-based visualizations.
*   [Frosted Glass Themes](https://github.com/wessamlauf/homeassistant-frosted-glass-themes) - For the beautiful glass-morphism aesthetic.
