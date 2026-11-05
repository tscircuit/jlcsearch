# Linux-capable Processors

[Search processors](/linux_capable_processors/list) · [JSON API](/linux_capable_processors/list.json)

Linux-capable Processors collects bare processor ICs from the JLC catalog with
documented Linux support and an application CPU with a memory management unit
(MMU). It includes both 32-bit and 64-bit Arm processors and selected 64-bit
RISC-V processors. A board still needs suitable RAM, storage, power circuitry,
and a board-specific Linux configuration.

## Coverage policy

The derived table uses a curated combination of manufacturer and part-number
family. Broad labels such as ARM, RISC-V, MCU, SoC, and Linux do not establish
eligibility. This deliberately excludes ordinary Cortex-M/Cortex-R MCUs, ESP32,
CH32V devices, and Kendryte K210; experimental Linux ports without an MMU are
outside this category. Development boards and system-on-module products are
also excluded, even when the catalog places them under MCU/MPU/SoC.

Candidate selection searches known MPN prefixes across catalog categories,
including legacy and global-sourcing categories. Mapping then requires a matching
silicon manufacturer and processor category, description, or package evidence.
Short Allwinner and RISC-V part names use bounded patterns to avoid collisions
with unrelated products. Missing or malformed manufacturer metadata is skipped.
Generic assembly-brand entries are not assigned a silicon manufacturer.

The architecture field is `ARM32`, `ARM64`, or `RISC-V64`. The CPU core field
describes the Linux application CPU, excluding auxiliary real-time cores. For
example, STM32MP1 reports Cortex-A7 rather than its optional Cortex-M4, and
Rockchip RK3588 reports Cortex-A76 + Cortex-A55.

## Families and source evidence

This list describes the initial coverage; it does not claim complete catalog or
mainline kernel support. Family-specific peripherals may require a vendor BSP.

| Manufacturer | Included families | Linux support and CPU sources |
| --- | --- | --- |
| Allwinner | F1C100S/200S; A10/A13/A20/A33/A64/A133; H3/H5/H6/H616/H618; V3S; T113/T507/T527; D1/D1S/F133 | [Linux Allwinner device trees](https://github.com/torvalds/linux/tree/master/arch/arm/boot/dts/allwinner), [64-bit Allwinner device trees](https://github.com/torvalds/linux/tree/master/arch/arm64/boot/dts/allwinner), [T113 and F133 product catalog](https://www.allwinnertech.com/uploads/download_source/20260303162657a4.pdf), [T527 product specifications and Tina Linux](https://www.allwinnertech.com/index.php?a=index&c=product&id=110), [D1 C906 product brief](https://www.allwinnertech.com/uploads/pdf/2021070515231402.pdf), [Linux Allwinner RISC-V device trees](https://github.com/torvalds/linux/tree/master/arch/riscv/boot/dts/allwinner) |
| Rockchip | RK3036/3066/3188/3288/3308/3328/3368/3399/3506/3562/3566/3568/3576/3588; RV1103/1106/1109/1126/1126B | [Rockchip open-source documentation and CPU specifications](https://opensource.rock-chips.com/), [Rockchip Linux kernel](https://github.com/rockchip-linux/kernel), [manufacturer datasheets](https://www.rock-chips.com/a/en/download/index.html). RV1126B uses Cortex-A53; the original RV1126 uses Cortex-A7. |
| STMicroelectronics | STM32MP13x/15x and STM32MP21x/23x/25x | [STM32MP1 and OpenSTLinux](https://www.st.com/en/microcontrollers-microprocessors/stm32mp1-series.html), [STM32 MPU portfolio](https://www.st.com/en/microcontrollers-microprocessors/stm32-arm-cortex-mpus.html), [STM32MP13x/21x architecture migration](https://www.st.com/resource/en/application_note/an6050-migrating-from-stm32mp13x-to-stm32mp21x-mpus-stmicroelectronics.pdf) |
| NXP / Freescale | i.MX 6 Cortex-A9 variants and UltraLite/ULL; i.MX 7; i.MX 8M Mini/Nano/Quad/Plus; i.MX 91/93/95 | [NXP Linux BSP supported devices](https://www.nxp.com/design/design-center/software/embedded-software/i-mx-software/embedded-linux-for-i-mx-applications-processors:IMXLINUX), [i.MX processor portfolio](https://www.nxp.com/products/processors-and-microcontrollers/arm-processors/i-mx-applications-processors:IMX_HOME). i.MX RT is excluded. |
| Texas Instruments | Sitara AM335x/AM437x/AM57x/AM62x (including AM62A/P)/AM64x/AM65x | [AM335x Linux SDK](https://www.ti.com/tool/PROCESSOR-SDK-AM335X), [AM57x Linux SDK](https://software-dl.ti.com/processor-sdk-linux/esd/AM57X/09_03_06_05/exports/docs/devices/AM57X/linux/index.html), [AM65x/AM437x Linux support](https://downloads.ti.com/processor-sdk-linux/esd/docs/05_01_00_11/linux/Release_Specific_Release_Notes.html), [AM62A Linux SDK](https://www.ti.com/tool/PROCESSOR-SDK-AM62A), [AM62P](https://www.ti.com/product/AM62P), [AM64x Linux SDK](https://www.ti.com/tool/PROCESSOR-SDK-AM64X). Cortex-R AM24/AM26 MCUs are excluded. |
| Microchip / Atmel | SAM9 and SAMA5D2/D3/D4 bare processors, including RAM-integrated SiPs | [Microchip Linux kernel and supported boards](https://developerhelp.microchip.com/xwiki/bin/view/applications/linux4sam/components/linuxkernel/), [older Linux4SAM boards](https://developerhelp.microchip.com/xwiki/bin/view/applications/linux4sam/Boards/archive/), [CPU and SiP specifications](https://www.microchip.com/content/dam/mchp/documents/MPU32/ProductDocuments/Brochures/Arm-Core-Based-Embedded-Microprocessors-DS60001434.pdf) |
| Canaan / Kendryte | K230/K230D | [K230 product brief explicitly identifies the C908 Linux CPU](https://www.kendryte.com/k230/en/main/K230_brief_datasheet.html), [K230/K230D Linux SDK resources](https://www.kendryte.com/en/resource?selected=0-2-2) |
| SOPHGO / CVITEK | CV1800B and SG2002, using the C906 RISC-V application CPU | [SOPHGO software documentation](https://github.com/sophgo/sophgo-doc), [SOPHGO SDK build guide](https://doc.sophgo.com/cvitek-develop-docs/master/docs_latest_release/CV180x_CV181x/en/01.software/BSP/SDK_Compilation_and_Usage_Guide/build/SDKCompilationandUsageGuide_en.pdf), [CV1800B board and Linux support](https://github.com/sophgocommunity/CV180-Duo) |

The classifier and its regression fixtures live in
`lib/db/derivedtables/linux-capable-processor.ts` and
`tests/lib/linux-capable-processor-derived-table.test.ts`.

## Clock speed and core count

`cpu_speed_hz` is the maximum catalog application CPU frequency in Hz, displayed
with MHz/GHz units. Unit-bearing values in `CPU Maximum Speed` are parsed; when
the catalog lists multiple clocks (for example `209MHz;650MHz` on STM32MP157),
the highest valid frequency is used. Bare numbers, placeholders, malformed JSON
and invalid frequencies remain unknown. The RK3506 catalog's 24 MHz oscillator
value is explicitly rejected. This is a rated clock, not a measured runtime clock.

`cpu_core_count` counts application-class CPU cores, including both clusters of
heterogeneous CPUs, excluding auxiliary Cortex-M/Cortex-R/MCU cores. RK3588 has
8 application cores; RK3506 has 3, and STM32MP157 has 2. Both K230 C908 CPUs are
counted, regardless of which OS an SDK assigns to each CPU. Core count is derived
from the matched family and, where necessary, the orderable part number, never
from a CPU architecture's theoretical maximum. Unverified variants stay null.

The shared rules in `lib/db/derivedtables/linux-processor-specs.ts` are used on
future imports and by `scripts/generate-linux-processor-specs-migration.ts` to
produce migration `0021_linux_processor_specs.sql`. The migration adds nullable
columns and backfills existing rows without changing stock, pricing or source
attributes. It does not require a full catalog rebuild. Local SQLite users can
rebuild with `bun run setup:derived-tables --reset linux_capable_processor`.

Additional specification evidence:

- [NXP i.MX 8M Mini datasheet, orderable part numbers](https://www.nxp.com/docs/en/data-sheet/IMX8MMCEC.pdf)
  and [i.MX 8M Nano datasheet, orderable part numbers](https://www.nxp.com/docs/en/data-sheet/IMX8MNCEC.pdf):
  suffixes 1/2, 3/4 and 5/6 identify one, two and four A53 cores respectively.
- [ST MP15 configuration table](https://wiki.st.com/stm32mpu/wiki/STM32MP15_microprocessor),
  [MP25 configuration table](https://wiki.st.com/stm32mpu/wiki/STM32MP25_microprocessor),
  [MP23 configuration table](https://wiki.st.com/stm32mpu/wiki/STM32MP23_microprocessor)
  and [MP21 architecture](https://www.st.com/en/microcontrollers-microprocessors/stm32mp213.html).
- [TI AM64x device comparison](https://www.ti.com/lit/ds/symlink/am6412.pdf):
  the final device digit distinguishes one or two A53 cores, independently of R5F count.
- [Rockchip RK3506 specifications](https://www.rock-chips.com/a/en/products/RK35_Series/2025/1208/2126.html):
  three Cortex-A7 cores; 24 MHz is not an application CPU clock.
- [Rockchip RV1106 brief](https://www.rock-chips.com/uploads/pdf/2022.8.26/192/RV1106%20Brief%20Datasheet.pdf):
  1.2 GHz Cortex-A7, separate 300 MHz MCU.
- [Luckfox RV1103 board specifications](https://wiki.luckfox.com/Luckfox-Pico/Luckfox-Pico-RV1103/):
  one Cortex-A7 at 1.2 GHz.
- [Rockchip RK3568 specifications](https://www.rock-chips.com/a/en/products/RK35_Series/2021/0113/1276.html):
  four Cortex-A55 cores up to 2 GHz. This fallback is limited to RK3568/RK3568B2;
  industrial J variants retain their own catalog clock or remain unknown.
- [Allwinner V3s specifications](https://www.allwinnertech.com/index.php?a=index&c=product&id=38):
  one Cortex-A7 up to 1.2 GHz.
- [Canaan K230 product brief](https://www.kendryte.com/k230/en/main/K230_brief_datasheet.html):
  two C908 CPUs at 800 MHz and 1.6 GHz.

Clock fallbacks are deliberately limited to documented parts. In particular,
F1C100S/200S and T113 entries with no catalog speed remain blank rather than
assuming a board's configured or overclocked frequency. See the family sources
above for the remaining core-count evidence.

## RAM

The list separates **On-chip SRAM** from **In-package DRAM**. **External** means
DRAM must be added to the board; a blank means the capacity is unverified. SRAM
may include reserved or auxiliary banks and is not the amount of RAM available
to Linux. The catalog's raw `RAM Size` is not used, because it mixes SRAM,
packaged DRAM and external address-space limits. See the
[RAM audit and sources](../linux-processor-memory.md) for exact part coverage,
capacity definitions and migration instructions.
