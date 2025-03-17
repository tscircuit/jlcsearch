export const pageTitles: Record<string, string> = {
  "/": "Home",
  "/components/list": "Components",
  "/capacitors/list": "Capacitors",
  "/diodes/list": "Diodes",
  "/lcd_display/list": "LCD Displays",
  "/headers/list": "Headers",
  "/led_segment_display/list": "LED Segment Displays",
  "/adcs/list": "Analog-to-Digital Converters",
  "/wifi_modules/list": "WiFi Modules",
  "/analog_multiplexers/list": "Analog Multiplexers",
  "/oled_display/list": "OLED Displays",
  "/led_drivers/list": "LED Drivers",
  "/voltage_regulators/list": "Voltage Regulators",
  "/microcontrollers/list": "Microcontrollers",
  "/dacs/list": "Digital-to-Analog Converters",
  "/io_expanders/list": "I/O Expanders",
  "/categories/list": "Component Categories",
}

export function getPageTitle(path: string): string {
  return pageTitles[path] || "JLCPCB Parts Search"
}
