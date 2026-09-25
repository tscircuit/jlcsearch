# Microcontroller USB audit: ranks 101–300

Audited 2026-09-24 against manufacturer product specifications and manufacturer-authored datasheets. This extends the [original top-100 audit](microcontroller-usb-audit.md) with the next 200 records by stock, with `lcsc ASC` breaking stock ties. The production snapshot was exported by [workflow run 36059041176](https://github.com/tscircuit/jlcsearch/actions/runs/36059041176), using:

```sql
SELECT lcsc, mfr, stock, has_usb FROM microcontroller
ORDER BY stock DESC, lcsc ASC LIMIT 300;
```

All 200 initially had `has_usb = 0`. The audit identifies **64 Yes and 136 No**, giving 64 additional corrections. Combined coverage is 300 distinct parts, with 97 Yes and 203 No. Sources are shared where a manufacturer specifies the same interface inventory for a part family; runtime overrides still match only the exact audited part numbers, including package/order suffixes.

“Has USB” means an on-chip USB data controller/interface. USB power delivery, USB-powered development boards, external USB programming adapters, software-only USB ISP, and CRC16_USB algorithms do not establish hardware USB support. A No decision is based on the peripheral inventory, not merely the absence of the word USB from a supplier description.

Caveats found during review:

- **FCM32F103CBT6:** the cited Flashchip datasheet confirms USB for revision C and later. The catalog does not identify silicon revision; this is a documented capability, not verification of the revision of physical stock.
- **CH334R:** a four-port USB 2.0 hub appears in the microcontroller category. It has USB, so its flag is corrected to Yes; category membership is unchanged.
- **MCP6042T-I/MS:** a dual op-amp appears in the microcontroller category. Its USB flag remains No; category membership is unchanged.
- **STC8H3K64S4 / STC8A8K64D4:** software USB download does not imply an on-chip USB controller.

The evidence manifest is `lib/db/derivedtables/microcontroller-usb-audit-next200.json`. It is used by both the derived-table import overrides and migration `0012_microcontroller_usb_next200.sql`. Previously released migration 0011 is unchanged. Regenerate only the new migration with:

```sh
bun scripts/generate-microcontroller-usb-migration.ts --next200
```

To export another read-only top-300 snapshot, dispatch **Build and Sync D1** with `sync_scope=audit_microcontrollers` and download the `microcontroller-usb-snapshot` artifact. To apply pending migrations without rebuilding derived tables, use `sync_scope=migrations_only`; this also clears cached responses and exports a verification snapshot.

| Rank | LCSC | Part | Has USB | Evidence |
| --- | --- | --- | --- | --- |
| 101 | C124713 | GD32F303VCT6 | Yes | [On-chip USB data interface.](https://www.gd32mcu.com/data/documents/userManual/GD32F30x_User_Manual_Rev2.9.pdf) |
| 102 | C132230 | ATMEGA328PB-AU | No | [Peripheral inventory has no USB data controller.](https://ww1.microchip.com/downloads/aemDocuments/documents/MCU08/ProductDocuments/DataSheets/40001906C.pdf) |
| 103 | C221386 | SC92F7251M16U | No | [SinOne peripheral inventory includes UART, not USB.](https://www.socmcu.com/en/product_show.php?id=83) |
| 104 | C382509 | N76E003AT20-T | No | [Peripheral inventory has no USB data controller.](https://www.nuvoton.com/products/microcontrollers/8bit-8051-mcus/low-pin-count-8051-series/n76e003/) |
| 105 | C2901876 | STC8G1K08-38I-SOP16 | No | [Peripheral inventory has no USB data controller.](https://www.stcmicro.com/stc/stc8g.html) |
| 106 | C124721 | STM32L151RCT6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32l151rc.html) |
| 107 | C521757 | STC8G1K08-38I-TSSOP20 | No | [Peripheral inventory has no USB data controller.](https://www.stcmicro.com/stc/stc8g.html) |
| 108 | C3013779 | GD32F303CBT6 | Yes | [On-chip USB data interface.](https://www.gd32mcu.com/data/documents/userManual/GD32F30x_User_Manual_Rev2.9.pdf) |
| 109 | C60420 | STM32F411CEU6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f411re.html) |
| 110 | C724044 | STM32G030K8T6TR | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32g030k6.html) |
| 111 | C3019113 | CW32F030C8T6 | No | [Peripheral inventory has no USB data controller.](https://m.whxy.com/uploads/files/20251229/CW32F030_DataSheet_EN_V1.0.pdf) |
| 112 | C503083 | STM32L011F4P6TR | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32l011f4.html) |
| 113 | C2874943 | STC8H3K64S4-45I-LQFP48 | No | [Software USB ISP download is supported; no hardware USB data controller.](https://www.stcmicro.com/datasheet/STC8H3K64S4_Features.pdf) |
| 114 | C77789 | GD32F103VCT6 | Yes | [On-chip USB data interface.](https://www.gigadevice.com/product/mcu/main-stream-mcus/gd32f10x-series/gd32f103) |
| 115 | C94046 | STM32F302CBT6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f302c8.html) |
| 116 | C529347 | STM32G071GBU6 | No | [USB Type-C Power Delivery only; no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32g071cb.html) |
| 117 | C8345 | STM32F105RCT6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f107vc.html) |
| 118 | C183214 | STM32F303RET6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f303rb.html) |
| 119 | C3018714 | PY32F003F16U6TR | No | [Peripheral inventory has no USB data controller.](https://www.puyasemi.com/download_path/%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/MCU%20%E5%BE%AE%E5%A4%84%E7%90%86%E5%99%A8/PY32F003_Reference_Manual_V1.5.pdf) |
| 120 | C169262 | STM8S005C6T6TR | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm8s005k6.html) |
| 121 | C529344 | STM32G071EBY6TR | No | [USB Type-C Power Delivery only; no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32g071cb.html) |
| 122 | C784689 | HC32F190FCUA-QFN32TR | No | [Communication inventory: four UART, two SPI, two I2C; no USB.](https://www.xhsc.com.cn/product/1275.html) |
| 123 | C781542 | APM32F030C8T6 | No | [Peripheral inventory has no USB data controller.](https://global.geehy.com/product/fifth/APM32F030) |
| 124 | C8707 | STC89C52RC-40I-LQFP44 | No | [Peripheral inventory has no USB data controller.](https://www.stcmicro.com/stc/stc89c51rc.html) |
| 125 | C1511928 | F1C100S | Yes | [USB OTG controller in manufacturer datasheet.](https://www.allwinnertech.com/uploads/pdf/20181218155101eb.pdf) |
| 126 | C2901854 | STC8A8K64D4-45I-LQFP64 | No | [Peripheral inventory has no USB data controller.](https://www.stcmicro.com/stc/stc8a8k64d4.html) |
| 127 | C95578 | STM32L151C8T6A | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32l151rc.html) |
| 128 | C915674 | STC8H1K08-36I-QFN20 | No | [Peripheral inventory has no USB data controller.](https://www.stcmicro.com/cn/stc/stc8h.html) |
| 129 | C2761416 | APM32F051C8T6 | No | [Peripheral inventory has no USB data controller.](https://global.geehy.com/product/fifth/APM32F051) |
| 130 | C3018717 | PY32F030F28U6TR | No | [Peripheral inventory has no USB data controller.](https://www.puyasemi.com/en/py32f030/2624.html) |
| 131 | C8294 | STM32F103VFT6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f103ze.html) |
| 132 | C128572 | PIC10F202T-I/OT | No | [Peripheral inventory has no USB data controller.](https://ww1.microchip.com/downloads/aemDocuments/documents/OTH/ProductDocuments/DataSheets/40001239F.pdf) |
| 133 | C3446133 | APM32F051K8U6 | No | [Peripheral inventory has no USB data controller.](https://global.geehy.com/product/fifth/APM32F051) |
| 134 | C724237 | STM32G071K8U6 | No | [USB Type-C Power Delivery only; no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32g071cb.html) |
| 135 | C29985 | STC15F2K60S2-28I-LQFP44 | No | [Peripheral inventory has no USB data controller.](https://www.stcmicro.com/cn/stc/stc15f2k60s2.html) |
| 136 | C493491 | HC32L110C4UA-SFN20TR | No | [Peripheral inventory has no USB data controller.](https://www.xhsc.com.cn/product/1244.html) |
| 137 | C724076 | STM32G071CBU3 | No | [USB Type-C Power Delivery only; no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32g071cb.html) |
| 138 | C129291 | GD32F330C8T6 | No | [Product selector USB column: 0.](https://www.gigadevice.com.cn/product/mcu/entry-level-mcus/gd32f3x0-series/gd32f330) |
| 139 | C2056847 | LPC804M101JHI33Y | No | [Serial peripherals: USART, SPI, I2C; no USB controller.](https://www.nxp.com/docs/en/nxp/data-sheets/LPC804_DS.pdf) |
| 140 | C2969777 | STM32F103C8T6TR | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f103ze.html) |
| 141 | C2901855 | STC8A8K64D4-45I-LQFP48 | No | [Peripheral inventory has no USB data controller.](https://www.stcmicro.com/stc/stc8a8k64d4.html) |
| 142 | C521758 | STC8G1K08-38I-QFN20 | No | [Peripheral inventory has no USB data controller.](https://www.stcmicro.com/stc/stc8g.html) |
| 143 | C8313 | STM32F103VCT6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f103ze.html) |
| 144 | C5128437 | PY32F003W16S6TU | No | [Peripheral inventory has no USB data controller.](https://www.puyasemi.com/download_path/%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/MCU%20%E5%BE%AE%E5%A4%84%E7%90%86%E5%99%A8/PY32F003_Reference_Manual_V1.5.pdf) |
| 145 | C20068 | STC15W204S-35I-SOP16 | No | [Peripheral inventory has no USB data controller.](https://www.stcmicro.com/stc/stc15w204s.html) |
| 146 | C8350 | STM32F105VCT6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f107vc.html) |
| 147 | C1121900 | STM32F103C8T7 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f103ze.html) |
| 148 | C724039 | STM32G030C8T6TR | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32g030k6.html) |
| 149 | C122930 | S9KEAZ64AMLH | No | [KEA communication inventory: UART, SPI, I2C and optional CAN; no USB.](https://www.nxp.com/products/KEA) |
| 150 | C8727 | ATMEGA88PA-AU | No | [Peripheral inventory has no USB data controller.](https://ww1.microchip.com/downloads/aemDocuments/documents/OTH/ProductDocuments/DataSheets/Atmel-9223-Automotive-Microcontrollers-ATmega48PA-ATmega88PA-ATmega168PA_Datasheet.pdf) |
| 151 | C2885643 | GD32C103CBT6 | Yes | [Product selector USB column: FS/OTG supported.](https://www.gigadevice.com.cn/product/mcu/main-stream-mcus/gd32c1x3-series/gd32c103) |
| 152 | C130280 | STM8S105C6T6TR | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm8s105k4.html) |
| 153 | C48242 | PIC16F1827T-I/SS | No | [Peripheral inventory has no USB data controller.](https://ww1.microchip.com/downloads/en/devicedoc/41391d.pdf) |
| 154 | C5122782 | CW32F003F4U7 | No | [Peripheral inventory has no USB data controller.](https://www.whxy.com/uploads/files/20240326/CW32F003_UserManual_EN_V1.0.pdf) |
| 155 | C3220543 | R5F10BBGKNA#G5 | No | [Manufacturer parameters: USB ports 0.](https://www.renesas.com/en/products/rl78f13/part-details/r5f10bbgkna-g5) |
| 156 | C917206 | LPC1765FBD100K | Yes | [USB device/host/OTG listed for LPC1765 and LPC1768.](https://www.nxp.com/docs/en/data-sheet/LPC1769_68_67_66_65_64_63.pdf) |
| 157 | C90795 | STM32F302C8T6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f302c8.html) |
| 158 | C6917294 | LKS32MC037EM6S8B | No | [Peripheral inventory has no USB data controller.](https://www.lksmcu.com/static/upload/file/20230113/LKS32MC03x_Datasheet_EN_v2.57.pdf) |
| 159 | C2687449 | V3s | Yes | [USB OTG interface in Allwinner V3s specifications.](https://www.allwinnertech.com/index.php?a=index&c=product&id=38) |
| 160 | C8696 | STC12C5A60S2-35I-LQFP44 | No | [Peripheral inventory has no USB data controller.](https://www.stcmicro.com/stc/stc12c5a32s2.html) |
| 161 | C81550 | GD32F103ZET6 | Yes | [On-chip USB data interface.](https://www.gigadevice.com/product/mcu/main-stream-mcus/gd32f10x-series/gd32f103) |
| 162 | C967938 | CH552E | Yes | [CH552 E8051 MCU has low/full-speed USB device controller.](https://www.wch-ic.com/downloads/CH552DS1_PDF.html) |
| 163 | C124291 | STM8S001J3M3TR | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm8s001j3.html) |
| 164 | C77994 | GD32F103C8T6 | Yes | [On-chip USB data interface.](https://www.gigadevice.com/product/mcu/main-stream-mcus/gd32f10x-series/gd32f103) |
| 165 | C116978 | STM32F401RET6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f401rc.html) |
| 166 | C2053303 | STM32F031G6U6TR | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32f031g6.html) |
| 167 | C784701 | HC32F170FAUA-QFN32TR | No | [Manufacturer datasheet covers FAUA-QFN32TR; four UART, two SPI, two I2C; no USB.](https://datasheet.lcsc.com/lcsc/2105241445_XHSC-HC32F170LATA-LQ52_C2833097.pdf) |
| 168 | C194372 | GD32F350G8U6TR | Yes | [Product selector USB column: FS/OTG supported.](https://www.gigadevice.com.cn/product/mcu/entry-level-mcus/gd32f3x0-series/gd32f350) |
| 169 | C75389 | STM32F429IIT6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f429ii.html) |
| 170 | C843788 | LPC1768FBD100K | Yes | [USB device/host/OTG listed for LPC1765 and LPC1768.](https://www.nxp.com/docs/en/data-sheet/LPC1769_68_67_66_65_64_63.pdf) |
| 171 | C380536 | GD32E230K8U6 | No | [Peripheral inventory has no USB data controller.](https://www.gigadevice.com/product/mcu/entry-level-mcus/gd32e23x-series/gd32e230) |
| 172 | C65700 | STM8S005C6T6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm8s005k6.html) |
| 173 | C2053986 | STM8S207C8T6TR | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm8s207c6.html) |
| 174 | C915660 | APM32F072CBT6 | Yes | [On-chip USB data interface.](https://global.geehy.com/product/fifth/APM32F072) |
| 175 | C18719 | STM8L151K4T6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm8l151k6.html) |
| 176 | C86951 | STM32F070F6P6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f070f6.html) |
| 177 | C92468 | STM32L431RCT6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32l431cc.html) |
| 178 | C81451 | STM32F051K6U6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32f051c8.html) |
| 179 | C2053278 | MSP430FR5720IRGER | No | [TI product parameters: USB No.](https://www.ti.com/product/MSP430FR5720) |
| 180 | C2827736 | STM32F051C8T6TR | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32f051c8.html) |
| 181 | C2055860 | TMS320F28035PNTR | No | [TI product parameters: USB No.](https://www.ti.com/product/TMS320F28035) |
| 182 | C521608 | STM32G474RET6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32g474re.html) |
| 183 | C3018720 | PY32F030K28T6 | No | [Peripheral inventory has no USB data controller.](https://www.puyasemi.com/en/py32f030/2624.html) |
| 184 | C256869 | STM32L151RET6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32l151rc.html) |
| 185 | C51330 | STM8L151C6T6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm8l151k6.html) |
| 186 | C61940 | STC15W408AS-35I-TSSOP20 | No | [Peripheral inventory has no USB data controller.](https://www.stcmicro.com/stc/stc15w408as.html) |
| 187 | C2687447 | AT32F421C8T7 | No | [Peripheral inventory has no USB data controller.](https://www.arterytek.com/cn/product/AT32F421.jsp) |
| 188 | C66572 | STM8S105K4U6A | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm8s105k4.html) |
| 189 | C9730 | PIC12F675-I/SN | No | [Peripheral inventory has no USB data controller.](https://www.microchip.com/en-us/product/PIC12F675) |
| 190 | C914618 | STC8H1K28-36I-LQFP32 | No | [Peripheral inventory has no USB data controller.](https://www.stcmicro.com/cn/stc/stc8h.html) |
| 191 | C526180 | APM32F103RCT6 | Yes | [On-chip USB data interface.](https://global.geehy.com/product/fifth/APM32F103) |
| 192 | C724053 | STM32G031G6U6TR | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32g031f8.html) |
| 193 | C2922795 | GD32E230F6P6TR | No | [Peripheral inventory has no USB data controller.](https://www.gigadevice.com/product/mcu/entry-level-mcus/gd32e23x-series/gd32e230) |
| 194 | C5110325 | GD32F310K8U6 | No | [Product selector USB column: 0.](https://www.gigadevice.com.cn/product/mcu/entry-level-mcus/gd32f3x0-series/gd32f310) |
| 195 | C19671 | STM32F103T8U6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f103ze.html) |
| 196 | C16121 | CY7C68013A-128AXC | Yes | [EZ-USB FX2LP high-speed USB peripheral controller.](https://www.infineon.com/dgdl/Infineon-CY7C68013A_CY7C68014A_CY7C68015A_CY7C68016A_EZ-USB_FX2LP_USB_Microcontroller_High-Speed_USB_Peripheral_Controller-DataSheet-v31_00-EN.pdf?fileId=8ac78c8c7d0d8da4017d0ec9f7974252) |
| 197 | C79207 | STM32L053R8T6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32l053r8.html) |
| 198 | C8290 | STM32F101ZGT6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32f101zg.html) |
| 199 | C915679 | STC8H1K24-36I-QFN32 | No | [Peripheral inventory has no USB data controller.](https://www.stcmicro.com/cn/stc/stc8h.html) |
| 200 | C8308 | STM32F103VET6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f103ze.html) |
| 201 | C5185726 | CKS32F030F4P6TR | No | [CKS manufacturer datasheet: USART, SPI, I2C; no USB controller.](https://atta.szlcsc.com/upload/public/pdf/source/20240222/F717710B84C887B83E967E0767721EC7.pdf) |
| 202 | C8304 | STM32F103CBT6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f103ze.html) |
| 203 | C660081 | ADUC7023BCP6Z62IRL | No | [SPI and I2C interfaces; USB-to-I2C programming adapter is external.](https://www.analog.com/media/en/technical-documentation/data-sheets/aduc7023.pdf) |
| 204 | C507089 | PIC16F1829T-I/SS | No | [Peripheral inventory has no USB data controller.](https://www.microchip.com/en-us/product/pic16f1829) |
| 205 | C5209379 | LKS32MC033H6P8 | No | [Peripheral inventory has no USB data controller.](https://www.lksmcu.com/static/upload/file/20230113/LKS32MC03x_Datasheet_EN_v2.57.pdf) |
| 206 | C915661 | APM32F030K6T6 | No | [Peripheral inventory has no USB data controller.](https://global.geehy.com/product/fifth/APM32F030) |
| 207 | C363195 | SC92F8003X20U | No | [SinOne datasheet lists UART and SSI (SPI/TWI); no USB.](https://www.socmcu.com/upfile/SC92F8003v0.1en.pdf) |
| 208 | C84216 | GD32F150G8U6TR | Yes | [Product selector USB column: FS/OTG supported.](https://www.gigadevice.com.cn/product/mcu/entry-level-mcus/gd32f1x0-series/gd32f150) |
| 209 | C81002 | STM32F042F4P6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f042f6.html) |
| 210 | C626881 | PIC16F676T-I/SL | No | [Peripheral inventory has no USB data controller.](https://ww1.microchip.com/downloads/en/devicedoc/40039f.pdf) |
| 211 | C36869 | STM32F407ZET6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f407zg.html) |
| 212 | C83547 | HT66F004 | No | [Peripheral inventory has no USB data controller.](https://www.holtek.com/webapi/116711/HT66F002_0025_003_004v230.pdf) |
| 213 | C2052951 | ATTINY202-SSNR | No | [Peripheral inventory has no USB data controller.](https://ww1.microchip.com/downloads/aemDocuments/documents/MCU08/ProductDocuments/DataSheets/ATtiny202-204-402-404-406-DataSheet-DS40002318A.pdf) |
| 214 | C5456188 | STM32C011F4U6TR | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32c011f4.html) |
| 215 | C2056713 | S9S08SG16E1MTGR | No | [MC9S08SG16 feature inventory: SCI, SPI, I2C; no USB.](https://www.nxp.com/docs/en/data-sheet/MC9S08SG32.pdf) |
| 216 | C111292 | CH552G | Yes | [CH552 E8051 MCU has low/full-speed USB device controller.](https://www.wch-ic.com/downloads/CH552DS1_PDF.html) |
| 217 | C528418 | AT32F413CBT7 | Yes | [On-chip USB data interface.](https://www.arterytek.com/cn/product/AT32F413.jsp) |
| 218 | C80488 | STM32F072C8T6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f072cb.html) |
| 219 | C880040 | GD32F303RGT6 | Yes | [On-chip USB data interface.](https://www.gd32mcu.com/data/documents/userManual/GD32F30x_User_Manual_Rev2.9.pdf) |
| 220 | C72339 | STM32F051K8U6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32f051c8.html) |
| 221 | C2052908 | STM32L011E4Y6TR | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32l011f4.html) |
| 222 | C2688743 | GD32F330G8U6TR | No | [Product selector USB column: 0.](https://www.gigadevice.com.cn/product/mcu/entry-level-mcus/gd32f3x0-series/gd32f330) |
| 223 | C2054095 | STM32F411CEU6TR | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f411re.html) |
| 224 | C124719 | STM32L471RGT6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32l471rg.html) |
| 225 | C94540 | GD32F130F6P6TR | No | [Product selector USB column: 0.](https://www.gigadevice.com.cn/product/mcu/entry-level-mcus/gd32f1x0-series/gd32f130) |
| 226 | C629746 | PIC16F876AT-I/SO | No | [Peripheral inventory has no USB data controller.](https://ww1.microchip.com/downloads/en/devicedoc/39582b.pdf) |
| 227 | C89374 | STM32F412RET6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f412re.html) |
| 228 | C148042 | PIC12F1572-I/SN | No | [Peripheral inventory has no USB data controller.](https://ww1.microchip.com/downloads/en/DeviceDoc/40001723D.pdf) |
| 229 | C86812 | LPC824M201JDH20J | No | [Peripheral inventory has no USB data controller.](https://www.nxp.com/docs/en/data-sheet/LPC82X.pdf) |
| 230 | C80491 | GD32F105RCT6 | Yes | [Product selector USB column: FS/OTG supported.](https://www.gigadevice.com.cn/product/mcu/main-stream-mcus/gd32f10x-series/gd32f105) |
| 231 | C60039 | PIC12F1822-I/SN | No | [Peripheral inventory has no USB data controller.](https://ww1.microchip.com/downloads/en/DeviceDoc/41406B.pdf) |
| 232 | C54328 | STM32F429IGT6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f429ii.html) |
| 233 | C2640145 | NUC029FAE | No | [Peripheral inventory has no USB data controller.](https://www.nuvoton.com/export/resource-files/DS_NUC029xAN_xAE_Series_EN_Rev1.11.pdf) |
| 234 | C783035 | S9KEAZN8AMTGR | No | [KEA communication inventory: UART, SPI, I2C and optional CAN; no USB.](https://www.nxp.com/products/KEA) |
| 235 | C2054944 | STM32F051K8T6TR | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32f051c8.html) |
| 236 | C2688744 | GD32F350K8U6 | Yes | [Product selector USB column: FS/OTG supported.](https://www.gigadevice.com.cn/product/mcu/entry-level-mcus/gd32f3x0-series/gd32f350) |
| 237 | C83181 | STM32L476VGT6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32l4x6.html) |
| 238 | C2904271 | HC32L110C6PA-TSSOP20TR | No | [Peripheral inventory has no USB data controller.](https://www.xhsc.com.cn/product/1244.html) |
| 239 | C724080 | STM32G071G8U6 | No | [USB Type-C Power Delivery only; no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32g071cb.html) |
| 240 | C966903 | ATSAMD21G18A-MU | Yes | [SAM D21G18A has full-speed USB device/host.](https://www.microchip.com/content/dam/mchp/documents/OTH/ProductDocuments/DataSheets/40001882A.pdf) |
| 241 | C99450 | STM32F334C8T6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/resource/en/datasheet/stm32f334c8.pdf) |
| 242 | C627438 | MCP6042T-I/MS | No | [Dual operational amplifier, not a microcontroller; no USB. Category anomaly retained.](https://ww1.microchip.com/downloads/en/DeviceDoc/20001669e.pdf) |
| 243 | C8254 | STM8S105K6T6C | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm8s105k4.html) |
| 244 | C2053369 | STM32F071CBT6TR | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32f071cb.html) |
| 245 | C2053338 | STM32F091CCT6TR | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32f091cc.html) |
| 246 | C915670 | STC8G2K32S4-36I-LQFP32 | No | [Peripheral inventory has no USB data controller.](https://www.stcmicro.com/stc/stc8g.html) |
| 247 | C2052845 | MSP430FR2111IPW16R | No | [TI product parameters: USB No.](https://www.ti.com/product/MSP430FR2111) |
| 248 | C2685746 | M031TD2AE | No | [M031TD2AE selection/pin tables have no USB; USB is on M032 variants.](https://www.nuvoton.com/export/resource-files/DS_M031_M032_Series_EN_Rev2.01.pdf) |
| 249 | C94770 | STM32L051K8U6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32l051c8.html) |
| 250 | C2054997 | STM32F302CBT6TR | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f302c8.html) |
| 251 | C526181 | APM32F103RET6 | Yes | [On-chip USB data interface.](https://global.geehy.com/product/fifth/APM32F103) |
| 252 | C2759986 | GD32F307VCT6 | Yes | [Product selector USB column: FS/OTG supported.](https://www.gigadevice.com.cn/product/mcu/main-stream-mcus/gd32f30x-series/gd32f307) |
| 253 | C8252 | STM8L152C6T6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm8l152c6.html) |
| 254 | C78269 | GD32F107VCT6 | Yes | [Product selector USB column: FS/OTG supported.](https://www.gigadevice.com.cn/product/mcu/main-stream-mcus/gd32f10x-series/gd32f107) |
| 255 | C2870559 | MSP430FR5964IPNR | No | [Serial peripheral inventory is eUSCI (UART, SPI, I2C), without USB.](https://www.ti.com/lit/ds/symlink/msp430fr5964.pdf) |
| 256 | C2053235 | ATTINY402-SSFR | No | [Peripheral inventory has no USB data controller.](https://ww1.microchip.com/downloads/aemDocuments/documents/MCU08/ProductDocuments/DataSheets/ATtiny202-204-402-404-406-DataSheet-DS40002318A.pdf) |
| 257 | C5158918 | MSP430FR6872IPMR | No | [TI product parameters: USB No.](https://www.ti.com/product/MSP430FR6872) |
| 258 | C49721 | STM8L151G6U6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm8l151k6.html) |
| 259 | C88376 | PIC16F1933-I/SS | No | [Peripheral inventory has no USB data controller.](https://ww1.microchip.com/downloads/en/DeviceDoc/41355B.pdf) |
| 260 | C784679 | HC32L196KCTA-LQ64 | No | [HC32L190/196 manufacturer datasheet communication inventory has UART, LPUART, SPI, I2C; no USB.](https://www.huazhoucn.com/downloads/xshc/DS_HC32L19x%E7%B3%BB%E5%88%97%E6%95%B0%E6%8D%AE%E6%89%8B%E5%86%8C_Rev1.73.pdf) |
| 261 | C115942 | STM32L071RBT6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32l071rb.html) |
| 262 | C2052778 | ATTINY816-MNR | No | [Peripheral inventory has no USB data controller.](https://onlinedocs.microchip.com/oxy/GUID-EE7956F6-534E-4B4F-AD10-214BF9914B5A-en-US-5/GUID-BED7C848-9A0F-453C-9C9B-CF77CB7E2B21.html) |
| 263 | C80735 | GD32F130C8T6 | No | [Product selector USB column: 0.](https://www.gigadevice.com.cn/product/mcu/entry-level-mcus/gd32f1x0-series/gd32f130) |
| 264 | C2835084 | GD32F303CGT6 | Yes | [On-chip USB data interface.](https://www.gd32mcu.com/data/documents/userManual/GD32F30x_User_Manual_Rev2.9.pdf) |
| 265 | C2870878 | MSP430FR2100IPW16R | No | [TI product parameters: USB No.](https://www.ti.com/product/MSP430FR2100) |
| 266 | C2054482 | STM8S207R8T6TR | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm8s207c6.html) |
| 267 | C8713 | STC11F32XE-35I-LQFP44 | No | [Peripheral inventory has no USB data controller.](https://www.stcmicro.com/stc/stc11f60xe.html) |
| 268 | C2054663 | STM32L431CCT6TR | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32l431cc.html) |
| 269 | C915966 | STM32L433VCT6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32l433vc.html) |
| 270 | C2835081 | GD32E230G6U6TR | No | [Peripheral inventory has no USB data controller.](https://www.gigadevice.com/product/mcu/entry-level-mcus/gd32e23x-series/gd32e230) |
| 271 | C279570 | STM8L052C6T6TR | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm8l052c6.html) |
| 272 | C2761417 | APM32F051K8T6 | No | [Peripheral inventory has no USB data controller.](https://global.geehy.com/product/fifth/APM32F051) |
| 273 | C16930 | STM8L151C8T6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm8l151k6.html) |
| 274 | C350645 | GD32E230K6U6 | No | [Peripheral inventory has no USB data controller.](https://www.gigadevice.com/product/mcu/entry-level-mcus/gd32e23x-series/gd32e230) |
| 275 | C39704 | STM32F103RCT6TR | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f103ze.html) |
| 276 | C730200 | STM32H750IBK6 | Yes | [USB OTG controllers documented for STM32H750.](https://www.st.com/resource/en/reference_manual/rm0433-stm32h742-stm32h743-753-and-stm32h750-value-line-advanced-armbased-32bit-mcus-stmicroelectronics.pdf) |
| 277 | C97412 | STM32F031K6U6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32f031g6.html) |
| 278 | C3018715 | PY32F030F18P6TU | No | [Peripheral inventory has no USB data controller.](https://www.puyasemi.com/en/py32f030/2624.html) |
| 279 | C374067 | MSP430F1121AIPWR | No | [TI product parameters: USB No.](https://www.ti.com/product/MSP430F1121A) |
| 280 | C85282 | PIC10F322T-I/OT | No | [Peripheral inventory has no USB data controller.](https://ww1.microchip.com/downloads/aemDocuments/documents/MCU08/ProductDocuments/DataSheets/PIC10%28L%29F320-322-Data-Sheet-40001585E.pdf) |
| 281 | C529413 | STM32G474RBT6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32g474re.html) |
| 282 | C3029773 | GD32F470VGT6 | Yes | [Product selector USB column: FS/OTG supported.](https://www.gigadevice.com.cn/product/mcu/high-performance-mcus/gd32f4xx-series/gd32f470) |
| 283 | C84571 | STM32F767IGT6 | Yes | [STM32F767 device summary and USB OTG interfaces.](https://www.st.com/resource/en/datasheet/stm32f765ig.pdf) |
| 284 | C8243 | STM8S207CBT6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm8s207c6.html) |
| 285 | C96514 | STM32L031G6U6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32l031g6.html) |
| 286 | C432207 | STM32G031K8U6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32g031f8.html) |
| 287 | C4154405 | CH334R | Yes | [CH334R is a USB 2.0 four-port hub, not a general-purpose MCU; USB is present. Category anomaly retained.](https://wch-ic.com/products/productsCenter/mcuInterface?categoryId=1&tName=USB+to+UART) |
| 288 | C1340271 | STM8S103K3T6CTR | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm8s103f3.html) |
| 289 | C784682 | HC32L190FCUA-QFN32TR | No | [HC32L190/196 manufacturer datasheet communication inventory has UART, LPUART, SPI, I2C; no USB.](https://www.huazhoucn.com/downloads/xshc/DS_HC32L19x%E7%B3%BB%E5%88%97%E6%95%B0%E6%8D%AE%E6%89%8B%E5%86%8C_Rev1.73.pdf) |
| 290 | C329282 | STM32F091VCT6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32f091cc.html) |
| 291 | C65701 | STM8S007C8T6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm8s007c8.html) |
| 292 | C5364174 | CW32L031C8U6 | No | [UART, SPI and I2C only; CRC16_USB names a checksum, not a USB controller.](https://www.whxy.com/uploads/files/20240829/CW32L031_DataSheet_EN_V1.0.pdf) |
| 293 | C624018 | PIC12F683T-I/SN | No | [Peripheral inventory has no USB data controller.](https://ww1.microchip.com/downloads/en/DeviceDoc/41211D.pdf) |
| 294 | C2972837 | FCM32F103CBT6 | Yes | [Flashchip datasheet: USB 2.0 FS on revision C and later; earlier silicon is not covered by this capability.](https://www.micros.com.pl/mediaserver/UIFCM32F103CBT6_FLASHCHIP_0001.pdf) |
| 295 | C9862 | STM32F051R8T6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm32f051c8.html) |
| 296 | C74909 | STM32F070CBT6 | Yes | [On-chip USB data interface.](https://www.st.com/en/microcontrollers-microprocessors/stm32f070f6.html) |
| 297 | C712540 | GD32E230K8T6 | No | [Peripheral inventory has no USB data controller.](https://www.gigadevice.com/product/mcu/entry-level-mcus/gd32e23x-series/gd32e230) |
| 298 | C91684 | STM8L152C8T6 | No | [Peripheral inventory has no USB data controller.](https://www.st.com/en/microcontrollers-microprocessors/stm8l152c6.html) |
| 299 | C3231326 | R5F100ADASP#10 | No | [Manufacturer parameters: USB ports 0.](https://www.renesas.com/en/products/rl78-g13/part-details/r5f100adasp-10) |
| 300 | C1850191 | LPC802M001JDH16J | No | [Peripheral inventory has no USB data controller.](https://www.nxp.com/docs/en/data-sheet/LPC802.pdf) |
