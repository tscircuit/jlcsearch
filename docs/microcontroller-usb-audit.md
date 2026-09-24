# Microcontroller USB audit (2026-09-24)

The 100 highest-stock results from `/microcontrollers/list.json?limit=100`
were reviewed against manufacturer peripheral inventories and datasheets.
`has_usb` means an on-chip USB data interface (device, host, or OTG), not
USB power delivery, a development-board USB connector, or an external
USB-to-UART adapter. STC8H8K64U has USB hardware, but its A silicon revision
restricts it to ISP; B and later revisions support user USB functions.

33 of these parts have USB; 32 were incorrectly false in the captured list.
Negative conclusions come from the complete peripheral inventory, not from
missing JLC attributes. References below may cover multiple memory/package
variants; the overrides deliberately match only the exact reviewed order codes.
Parts outside this audit retain the existing supplier-derived classification,
so this is not a claim that the entire catalog has been verified.

`lib/db/derivedtables/microcontroller-usb-audit.json` is the shared evidence
and override source. The import pipeline uses these overrides after reading
supplier attributes, preventing subsequent derived-table syncs from undoing
the corrections. Migration 0011 updates only `has_usb` for those exact MFRs
(including duplicate LCSC listings of the same MFR), leaving other records
and fields untouched. It is idempotent and creates no schema objects.

Regenerate the migration before it has been released with:

```sh
bun scripts/generate-microcontroller-usb-migration.ts
```

After release, use a new migration for further audit changes. Run pending
migrations with `bunx wrangler d1 migrations apply jlcsearch --remote` from
`cf-proxy`, or dispatch **Build and Sync D1** with `sync_scope=migrations_only`.
The workflow clears cached responses without rebuilding the component catalog.

The UI provides **Has USB: All / Yes / No**. API clients can use
`/microcontrollers/list.json?has_usb=true` or `has_usb=false`; omitting the
parameter leaves the list unfiltered. Existing package/core/memory filters
can be combined with it.

| Stock rank | LCSC | Manufacturer part | Before | Audited | Manufacturer evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | C8734 | STM32F103C8T6 | No | Yes | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f103c8.html) |
| 2 | C52717 | STM8S003F3P6TR | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm8s003f3.html) |
| 3 | C529330 | STM32G030F6P6TR | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32g030f6.html) |
| 4 | C18088 | STM8L051F3P6TR | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm8l051f3.html) |
| 5 | C915673 | STC8H1K08-36I-TSSOP20 | No | No | [Reference](https://www.stcmicro.com/cn/stc/stc8h.html) |
| 6 | C529355 | STM32G431CBT6 | No | Yes | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32g431cb.html) |
| 7 | C915663 | STC8G1K08A-36I-SOP8 | No | No | [Reference](https://www.stcmicro.com/stc/stc8g.html) |
| 8 | C5292060 | PY32F002AL15S6TU | No | No | [Reference](https://www.puyasemi.com/download_path/%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/MCU%20%E5%BE%AE%E5%A4%84%E7%90%86%E5%99%A8/PY32F002A_Reference_Manual_V1.4.pdf) |
| 9 | C46830 | STM32F030K6T6 | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f030k6.html) |
| 10 | C529329 | STM32G030C8T6 | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32g030c8.html) |
| 11 | C89040 | STM32F030F4P6TR | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f030f4.html) |
| 12 | C529331 | STM32G030K6T6 | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32g030k6.html) |
| 13 | C915668 | STC8G2K64S4-36I-LQFP48 | No | No | [Reference](https://www.stcmicro.com/stc/stc8g.html) |
| 14 | C2040 | RP2040 | No | Yes | [Reference](https://www.raspberrypi.com/products/rp2040/specifications/) |
| 15 | C713818 | STC8G1K08-36I-SOP8 | No | No | [Reference](https://www.stcmicro.com/stc/stc8g.html) |
| 16 | C380535 | GD32E230C8T6 | No | No | [Reference](https://www.gigadevice.com/product/mcu/entry-level-mcus/gd32e23x-series/gd32e230) |
| 17 | C23922 | STM32F030C8T6 | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f030c8.html) |
| 18 | C8257 | STM8S903K3T6CTR | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm8s903k3.html) |
| 19 | C465921 | MS51FB9AE-T | No | No | [Reference](https://direct.nuvoton.com/zh/ms51fb9ae) |
| 20 | C431631 | STM32G030K8T6 | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32g030k8.html) |
| 21 | C8736 | STM8S105K4T6C | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm8s105k4.html) |
| 22 | C35556 | STM8S003F3U6TR | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm8s003f3.html) |
| 23 | C529338 | STM32G070CBT6 | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32g070cb.html) |
| 24 | C110878 | STM32L051C8T6 | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32l051c8.html) |
| 25 | C18615 | STM8S003F3P6 | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm8s003f3.html) |
| 26 | C28730 | STM32F407VET6 | No | Yes | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f407ve.html) |
| 27 | C486681 | STM32L431CCT6 | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32l431cc.html) |
| 28 | C2802165 | STM32L051C8T6TR | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32l051c8.html) |
| 29 | C62514 | STM32F030C6T6 | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f030c6.html) |
| 30 | C74524 | STM32F401RCT6 | No | Yes | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f401rc.html) |
| 31 | C133172 | S9KEAZ128AMLH | No | No | [Reference](https://www.nxp.com/docs/en/product-brief/SKEA128PB.pdf) |
| 32 | C168658 | PMS150C-U06 | No | No | [Reference](https://www.padauk.com.tw/upload/doc/PMS15A%2CPMS150C%20datasheet_CN_V110_20230216.pdf) |
| 33 | C8309 | STM8S103K3T6C | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm8s103k3.html) |
| 34 | C329283 | STM32L011F4U6TR | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32l011f4.html) |
| 35 | C8735 | STM32F103RBT6 | No | Yes | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f103rb.html) |
| 36 | C724040 | STM32G030F6P6 | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32g030f6.html) |
| 37 | C9863 | STM32F051C8T6 | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f051c8.html) |
| 38 | C5292059 | PY32F002AF15P6TU | No | No | [Reference](https://www.puyasemi.com/download_path/%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/MCU%20%E5%BE%AE%E5%A4%84%E7%90%86%E5%99%A8/PY32F002A_Reference_Manual_V1.4.pdf) |
| 39 | C106925 | STM32F030C6T6TR | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f030c6.html) |
| 40 | C37925 | STM8S005K6T6C | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm8s005k6.html) |
| 41 | C8322 | STM32F103RET6 | No | Yes | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f103re.html) |
| 42 | C393540 | APM32F103C8T6 | No | Yes | [Reference](https://global.geehy.com/product/fifth/APM32F103) |
| 43 | C15742 | STM32F405RGT6 | No | Yes | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f405rg.html) |
| 44 | C529356 | STM32G431CBU6 | No | Yes | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32g431cb.html) |
| 45 | C2969989 | STM32F042F6P6TR | Yes | Yes | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f042f6.html) |
| 46 | C94355 | STM32F411RET6 | No | Yes | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f411re.html) |
| 47 | C2847904 | STM32G0B1CBT6 | No | Yes | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32g0b1cb.html) |
| 48 | C108516 | STM32F303CBT6 | No | Yes | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f303cb.html) |
| 49 | C90832 | N76E003AQ20 | No | No | [Reference](https://www.nuvoton.com/products/microcontrollers/8bit-8051-mcus/low-pin-count-8051-series/n76e003/) |
| 50 | C131443 | GD32F303RCT6 | No | Yes | [Reference](https://www.gd32mcu.com/data/documents/userManual/GD32F30x_User_Manual_Rev2.9.pdf) |
| 51 | C3018718 | PY32F030K28U6TR | No | No | [Reference](https://www.puyasemi.com/en/py32f030/2624.html) |
| 52 | C34222 | STM8L052R8T6 | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm8l052r8.html) |
| 53 | C66710 | STM8L052C6T6 | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm8l052c6.html) |
| 54 | C81720 | STM32F072CBT6 | No | Yes | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f072cb.html) |
| 55 | C962264 | GD32E230F8V6TR | No | No | [Reference](https://www.gigadevice.com/product/mcu/entry-level-mcus/gd32e23x-series/gd32e230) |
| 56 | C915664 | STC8G1K08A-36I-DFN8 | No | No | [Reference](https://www.stcmicro.com/stc/stc8g.html) |
| 57 | C915675 | STC8H1K17-36I-TSSOP20 | No | No | [Reference](https://www.stcmicro.com/cn/stc/stc8h.html) |
| 58 | C5292058 | PY32F002AA15M6TU | No | No | [Reference](https://www.puyasemi.com/download_path/%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/MCU%20%E5%BE%AE%E5%A4%84%E7%90%86%E5%99%A8/PY32F002A_Reference_Manual_V1.4.pdf) |
| 59 | C380785 | GD32E230F8P6TR | No | No | [Reference](https://www.gigadevice.com/product/mcu/entry-level-mcus/gd32e23x-series/gd32e230) |
| 60 | C94618 | NUC029LAN | No | No | [Reference](https://www.nuvoton.com/products/microcontrollers/arm-cortex-m0-mcus/nuc029-series/nuc029lan/index.html) |
| 61 | C2917159 | STM32L073RBT6 | No | Yes | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32l073rb.html) |
| 62 | C529340 | STM32G070RBT6 | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32g070rb.html) |
| 63 | C130453 | STM32F303RBT6 | No | Yes | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f303rb.html) |
| 64 | C77940 | GD32F103RET6 | No | Yes | [Reference](https://www.gigadevice.com/product/mcu/main-stream-mcus/gd32f10x-series/gd32f103) |
| 65 | C82751 | N76E003AT20 | No | No | [Reference](https://www.nuvoton.com/products/microcontrollers/8bit-8051-mcus/low-pin-count-8051-series/n76e003/) |
| 66 | C8259 | STM8L151K6T6 | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm8l151k6.html) |
| 67 | C80687 | GD32F103RCT6 | No | Yes | [Reference](https://www.gigadevice.com/product/mcu/main-stream-mcus/gd32f10x-series/gd32f103) |
| 68 | C19156 | STM32F407ZGT6 | No | Yes | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f407zg.html) |
| 69 | C529334 | STM32G031F8P6 | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32g031f8.html) |
| 70 | C39105 | STM32F030R8T6 | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f030r8.html) |
| 71 | C116152 | GD32F303RET6 | No | Yes | [Reference](https://www.gd32mcu.com/data/documents/userManual/GD32F30x_User_Manual_Rev2.9.pdf) |
| 72 | C914617 | STC8H1K16-36I-LQFP32 | No | No | [Reference](https://www.stcmicro.com/cn/stc/stc8h.html) |
| 73 | C54946 | STC15W408AS-35I-SOP16 | No | No | [Reference](https://www.stcmicro.com/stc/stc15w408as.html) |
| 74 | C3032170 | N32G430C8L7 | No | No | [Reference](https://www.nationstech.com/product/general/n32g/n32g43x/) |
| 75 | C724043 | STM32G030K6T6TR | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32g030k6.html) |
| 76 | C529343 | STM32G071CBU6 | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32g071cb.html) |
| 77 | C5142280 | CH32V203G6U6 | No | Yes | [Reference](https://www.wch-ic.com/products/CH32V203.html) |
| 78 | C967653 | STM8S005K6T6CTR | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm8s005k6.html) |
| 79 | C408539 | MS51FB9AE | No | No | [Reference](https://direct.nuvoton.com/zh/ms51fb9ae) |
| 80 | C77979 | GD32F103CBT6 | No | Yes | [Reference](https://www.gigadevice.com/product/mcu/main-stream-mcus/gd32f10x-series/gd32f103) |
| 81 | C507118 | ATTINY1616-MNR | No | No | [Reference](https://www.microchip.com/en-us/product/ATTINY1616) |
| 82 | C91298 | HT66F002 | No | No | [Reference](https://www.holtek.com/webapi/116711/HT66F002_0025_003_004v230.pdf) |
| 83 | C8315 | STM32F107VCT6 | No | Yes | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f107vc.html) |
| 84 | C528755 | LPC824M201JHI33Y | No | No | [Reference](https://www.nxp.com/docs/en/data-sheet/LPC82X.pdf) |
| 85 | C129127 | PMS150C-S08 | No | No | [Reference](https://www.padauk.com.tw/upload/doc/PMS15A%2CPMS150C%20datasheet_CN_V110_20230216.pdf) |
| 86 | C513828 | MKL17Z64VFM4 | No | No | [Reference](https://www.nxp.com/docs/en/data-sheet/KL17P64M48SF2.pdf) |
| 87 | C691535 | LPC1788FBD208K | No | Yes | [Reference](https://www.nxp.com/docs/en/data-sheet/LPC178X_7X.pdf) |
| 88 | C1343942 | R5F562T6DDFF#V1 | No | No | [Reference](https://www.renesas.com/en/products/rx62t) |
| 89 | C707444 | HK32F030MF4P6 | No | No | [Reference](https://v4.cecdn.yun300.cn/100001_1901185243/HK32F030M_Datasheet_Rev.1.3.11667556085192.pdf) |
| 90 | C92081 | STM8S103F3P6TR | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm8s103f3.html) |
| 91 | C5291740 | PY32F002AW15U6TR | No | No | [Reference](https://www.puyasemi.com/download_path/%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/MCU%20%E5%BE%AE%E5%A4%84%E7%90%86%E5%99%A8/PY32F002A_Reference_Manual_V1.4.pdf) |
| 92 | C77963 | GD32F103RBT6 | No | Yes | [Reference](https://www.gigadevice.com/product/mcu/main-stream-mcus/gd32f10x-series/gd32f103) |
| 93 | C116151 | GD32F303CCT6 | No | Yes | [Reference](https://www.gd32mcu.com/data/documents/userManual/GD32F30x_User_Manual_Rev2.9.pdf) |
| 94 | C94784 | STM32L432KBU6 | No | Yes | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32l432kb.html) |
| 95 | C8314 | STM32F103VBT6 | No | Yes | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f103vb.html) |
| 96 | C3013145 | STC8H8K64U-45I-LQFP48 | No | Yes | [Reference](https://www.stcmicro.com/stc/stc8h8k64u.html) |
| 97 | C8287 | STM32F103ZET6 | No | Yes | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32f103ze.html) |
| 98 | C432212 | STM32G071CBT6 | No | No | [Reference](https://www.st.com/en/microcontrollers-microprocessors/stm32g071cb.html) |
| 99 | C5182268 | LKS32MC037EM6S8 | No | No | [Reference](https://www.lksmcu.com/static/upload/file/20230113/LKS32MC03x_Datasheet_EN_v2.57.pdf) |
| 100 | C80215 | GD32F103VET6 | No | Yes | [Reference](https://www.gigadevice.com/product/mcu/main-stream-mcus/gd32f10x-series/gd32f103) |

The audit now also covers [ranks 101–300](microcontroller-usb-audit-next200.md), with a separate migration 0012 preserving this original migration.
