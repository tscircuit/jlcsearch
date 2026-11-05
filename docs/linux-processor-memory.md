# Linux processor RAM audit

The processor list and JSON API expose two independent nullable byte counts:

- `sram_size_bytes` / **On-chip SRAM**: the explicitly documented internal RAM
  banks listed below. This excludes CPU caches, optional cache-as-RAM modes,
  ROM and flash. Reserved, secure, backup or auxiliary-CPU banks may be included
  in a manufacturer's aggregate. It is not a measure of Linux-usable RAM, nor
  a sum of every peripheral buffer or tightly coupled memory in the SoC.
- `integrated_dram_size_bytes` / **In-package DRAM**: physical DRAM shipped
  inside the processor package. Zero means a verified external-DRAM design and
  displays **External**. Null means unverified and displays a blank cell.
  An external memory controller's addressable capacity is never installed RAM.

Values use binary capacities (KB = 1024 bytes, MB = 1024² bytes), consistent with
other byte fields in the application. For example, 1 Gbit DRAM is 128 MB, not
1 GB. SRAM and DRAM are never added into a misleading combined capacity.

## Evidence checked on 2026-11-05

The rules are restricted to the matched silicon family and orderable MPNs in
`lib/db/derivedtables/linux-processor-memory.ts`. Unlisted variants stay unknown;
there is deliberately no fallback to the catalog's ambiguous `RAM Size` field.

| Parts | Verified memory | Primary evidence |
| --- | --- | --- |
| F1C100S / F1C200S | 32 / 64 MB packaged DDR1 | [Allwinner F1C100s brief](https://www.allwinnertech.com/uploads/pdf/20181218155101eb.pdf); [Allwinner F1C200s datasheet](https://www.thirtythreeforty.net/posts/trying-the-f1c200s/Allwinner_F1C200s_Datasheet_V1.1.pdf), with [firsthand verification of manufacturer samples](https://www.thirtythreeforty.net/posts/trying-the-f1c200s/) |
| V3S / F133-A,B / D1S | 64 MB packaged DRAM | [Allwinner V3s](https://www.allwinnertech.com/index.php?a=index&c=product&id=38), [F133](https://www.allwinnertech.com/index.php?a=index&c=product&id=101), [Allwinner D1s hardware documentation](https://docs.aw-ol.com/d1s/hard/hard_2sch/) |
| T113-S3 | 128 MB packaged DDR3 | [Allwinner datasheet, section 2.3.2](https://dl.100ask.net/Hardware/MPU/100ask_t113-pro/T113-s3_datasheet_v1.6.pdf). This is not applied to T113-I or unspecified T113 variants. |
| H3 | External DRAM | [Allwinner H3 datasheet, memory controller section](https://dl.linux-sunxi.org/H3/Allwinner_H3_Datasheet_V1.0.pdf). Catalog `2GB` is not in-package RAM. |
| RV1103G1 | 64 MB packaged DDR2 | [Rockchip datasheet, section 1.2.2](https://rockchips.net/wp-content/uploads/2025/03/Rockchip-RV1103-Datasheet-V1.4-20230725.pdf) (512 Mbit); [Luckfox RV1103 specifications](https://wiki.luckfox.com/Luckfox-Pico/Luckfox-Pico-RV1103/) |
| RV1106G2 / RV1106G3 | 128 / 256 MB packaged DRAM | [Rockchip RV1106 brief](https://www.rock-chips.com/uploads/pdf/2022.8.26/192/RV1106%20Brief%20Datasheet.pdf) for G2; [Luckfox Pico Pro/Max specifications](https://wiki.luckfox.com/Luckfox-Pico-Pro-Max/) for G2/G3. Bare RV1106 is not assigned a capacity. |
| RK3506G1 / G2 / B,J | 64 / 128 MB / external DRAM | [Rockchip RK3506 product specifications](https://www.rock-chips.com/a/en/products/RK35_Series/2025/1208/2126.html). DDR interfaces on B/J are not integrated memory. |
| STM32MP13x | 168 KB SRAM; external DRAM | [ST datasheet](https://www.st.com/resource/en/datasheet/stm32mp135a.pdf): 128 KB AXI SYSRAM + 32 KB AHB SRAM + 8 KB backup SRAM. |
| STM32MP151/153/157 | 708 KB SRAM; external DRAM | [ST MP153](https://www.st.com.cn/zh/microcontrollers-microprocessors/stm32mp153d.html), [ST MP157 datasheet](https://www.st.com/resource/en/datasheet/stm32mp157a.pdf): 256 + 3×128 + 64 + 4 KB, including backup banks. |
| i.MX 6ULL (MCIMX6Y/MIMX6Y) | 128 KB OCRAM; external DRAM | [NXP i.MX 6ULL datasheet](https://www.nxp.com/docs/en/data-sheet/IMX6ULLCEC.pdf). Do not transfer catalog `256KB` or an L2 cache size to this field. |
| i.MX 8M Mini | 288 KB SRAM; external DRAM | [NXP datasheet, Table 1](https://www.nxp.com/docs/en/data-sheet/IMX8MMCEC.pdf): 256 + 32 KB on-chip RAM, including the secure bank. |
| i.MX 8M Nano | 544 KB SRAM; external DRAM | [NXP datasheet, Table 1](https://www.nxp.com/docs/en/data-sheet/IMX8MNCEC.pdf): 512 + 32 KB on-chip RAM, including the secure bank. |
| AM335x / AM437x / AM623x,625x / AM64x | External DRAM; SRAM left unverified | TI memory-interface sections: [AM335x](https://www.ti.com/lit/ds/symlink/am3358.pdf), [AM437x](https://www.ti.com/lit/ds/symlink/am4378.pdf), [AM62x](https://www.ti.com/lit/ds/symlink/am625.pdf), [AM64x](https://www.ti.com/lit/ds/symlink/am6412.pdf). Excludes AM625SIP; differing SRAM domains are not collapsed into a guessed total. |
| SAMA5D3 | 128 KB SRAM; external DRAM | [Microchip datasheet, section 5.1.1](https://www.microchip.com/content/dam/mchp/documents/MPU32/ProductDocuments/DataSheets/SAMA5D3-Series-Data-sheet-DS60001609b.pdf). |
| SAMA5D2 | 128 KB SRAM; packaged DRAM unverified | [Microchip datasheet, section 8.1.1](https://ww1.microchip.com/downloads/en/DeviceDoc/SAMA5D2-Series-Datasheet-DS60001476H.pdf). Excludes the additional configurable L2 cache-as-RAM. SiP suffixes need separate DRAM evidence. |
| SAM9X60D5M(T) / D1G(T) | 68 KB SRAM; 64 / 128 MB packaged DDR2 | [Microchip SiP datasheet, configuration summary and ordering table](https://ww1.microchip.com/downloads/aemDocuments/documents/MPU32/ProductDocuments/DataSheets/SAM9X60-SIP-Data-Sheet-DS60001580.pdf): SRAM0 64 KB + SRAM1 4 KB; DRAM 512 Mbit / 1 Gbit. `T` is tape-and-reel, not a different capacity. |
| K230 / K230D | 4 MB SRAM; external / 128 MB packaged DRAM | [Canaan product brief](https://www.kendryte.com/k230/en/main/K230_brief_datasheet.html): 2 + 2 MB SRAM, partly assigned to the KPU by default; [Canaan K230D specifications](https://www.kendryte.com/en/products?m=123) and [vendor hardware design guide](https://github.com/kendryte/k230_docs/blob/main/en/00_hardware/K230_Hardware_Design_Guide.md). |

## Import and migration behavior

Migration `0022_linux_processor_memory.sql` adds and backfills only these two
columns. It is generated from the same rules as future imports with
`bun scripts/generate-linux-processor-memory-migration.ts`. It does not modify
CPU specifications, stock, prices or raw catalog attributes. Migration tests
compare every fixture against importer output, including malformed attributes,
unknown variants, external-only parts and bit-to-byte conversions.

For a local source database, rebuild with
`bun run setup:derived-tables --reset linux_capable_processor`.
