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
