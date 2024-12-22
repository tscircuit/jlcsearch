# jlcsearch (in-stock jlcpcb search engine)

[Search for Parts](https://jlcsearch.tscircuit.com) ⋅ [tscircuit](https://github.com/tscircuit/tscircuit) ⋅ [discord](https://tscircuit.com/join)

This is an in-stock parts search engine for JLCPCB parts. It also
features an easy-to-use API (just add ".json")

![image](https://github.com/user-attachments/assets/bf036e76-f67d-47f6-b1f8-01de0dfe3fd2)

## API Usage

You can go on any page and click "json" in the top right corner to automatically convert whatever filter you've made to a JSON query.

```bash
curl https://jlcsearch.tscircuit.com/resistors/list.json?package=&resistance=1k

#{
#  "resistors": [
#    {
#      "lcsc": 21190,
#      "mfr": "0603WAF1001T5E",
#      "package": "0603",
#      "resistance": 1000,
#      "tolerance_fraction": 0.01,
#      "power_watts": 100,
#      "stock": 31485061,
#      "price1": 0.000814286
#    },
#    {
#      "lcsc": 11702,
#      "mfr": "0402WGF1001TCE",
#      "package": "0402",
#      "resistance": 1000,
#      ...
```

## Development

Run `bun i` then `bun run setup` to download the necessary dependencies and vendor data.
