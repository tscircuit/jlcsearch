# jlcsearch (in-stock jlcpcb search engine)

[Search for Parts](https://jlcsearch.tscircuit.com) ⋅ [tscircuit](https://github.com/tscircuit/tscircuit) ⋅ [discord](https://tscircuit.com/join)

This is an in-stock parts search engine for JLCPCB parts. It also
features an easy-to-use API (just add ".json")

![image](https://github.com/user-attachments/assets/bf036e76-f67d-47f6-b1f8-01de0dfe3fd2)

## API Usage

You can go on any page and click "json" in the top right corner to automatically convert whatever filter you've made to a JSON query.

```bash
curl https://jlcsearch.tscircuit.com/resistors/list.json?package=&resistance=1k

# {
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

Run `bun i` then `bun run setup` to download the necessary dependencies and vendor data,
you can then run `bun run start` to start the server.

All the routes are in the `routes` folder. If you want to add a new page/table,
you can do the following:

1. Create a new "derived table" inside `lib/db/derivedtables`, reference `docs`
   to understand the structure and available properties for different components
2. Run `bun run scripts/setup-derived-tables.ts --reset led_driver` (if `led_driver` is the name of the table you're adding)
3. Create a new route inside `routes` to represent the page
4. Add the new route to the `routes/index.ts` file

AI is incredibly good at performing every step in the process above, end to end.
I recommend using [aider](https://www.aider.chat/) and adding docs, lib, routes
and scripts folders to the context.

## Acknowledgements

None of this would be possible without [JLCPCB](https://jlcpcb.com) and the work
[jlcparts](https://github.com/yaqwsx/jlcparts) project.
