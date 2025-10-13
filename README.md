# jlcsearch (in-stock jlcpcb search engine and API)

[Search for Parts](https://jlcsearch.tscircuit.com) ⋅ [tscircuit](https://github.com/tscircuit/tscircuit) ⋅ [discord](https://tscircuit.com/join)

This is an in-stock parts search engine for JLCPCB parts. It also
features an easy-to-use API (just add ".json")

Play with it at [jlcsearch.tscircuit.com](https://jlcsearch.tscircuit.com)

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

Prerequisites \& Notes:  The automation scripts in this repo are only set up for macOS and Linux development.  The setup command below will fail if run on Windows, but no worries, you can simply use WSL (although it may be very slow).    [Bun](https://bun.com/) is required, so follow the Installing &rarr; macOS and Linux instructions [here](https://bun.com/docs/installation#macos-and-linux) (same for WSL).  

Run `bun i` then `bun run setup` to download the necessary dependencies and vendor data (be aware this can take a while),
you can then run `bun run start` to start the server.

All the routes are in the `routes` folder. If you want to add a new page/table,
you can do the following:

1. Create a new "derived table" inside `lib/db/derivedtables`, reference `docs`
   to understand the structure and available properties for different components
2. Run `bun run scripts/setup-derived-tables.ts --reset led_driver` (if `led_driver` is the name of the table you're adding)
3. Run `bun run generate:db-types` to generate the new table types
4. Create a new route inside `routes` to represent the page
5. Add the new route to the `routes/index.ts` file
6. Make sure to run `bun run format`

AI is incredibly good at performing every step in the process above, end to end.
I recommend using [aider](https://www.aider.chat/) and adding docs, lib, routes
and scripts folders to the context.

## How Does It work?
As a developer new to this codebase, or a curious user, you may have some questions about the flow of data through the scripts and automations inside this repo.  It all starts with the [jlcparts](https://github.com/yaqwsx/jlcparts) project, which compiles a massive **11GB** sqlite3 database of *everything* [JLCPCB](https://jlcpcb.com) has to offer.  As you can imagine, this would be very resource-intensive and slow to search, so the next steps are scripts that optimize it heavily, although it's more accurate to say that they rebuild it entirely. 
`scripts/setup-db-optimizations.ts` and `scripts/setup-derived-tables.ts` show the various optimizations that are performed, including:
- Removing stale components that haven't been in stock for over a year.
- Only keeping categories of components that we are currently interested in and have a schema defined for (see the corresponding component types in `lib/db/derivedtables` for examples).
- Adding columns for traits that we care about such as price, stock level, and basic/ preferred status (to save on assembly costs).

The result is `db.sqlite3` which presently comes in at **under 2GB** in size. 

If you wish to use some data that exists in the [jlcparts](https://github.com/yaqwsx/jlcparts) database but is not yet being brought over to the optimized `db.sqlite3`, you can look at the originating database to get familiar with it and find the data structures you wish to bring over.  An easy way to do this can be: after you have run `bun run setup` and it has completed, the cache zip archive files are still located at `./buildtmp` - simply unpack these yourself (preferably into a separate directory outside of the project) and there is your 11GB `cache.sqlite3` database to look at.  

To recap:
- If you wish to use additional **component data** (like the basic/ preferred status) that exists in [jlcparts](https://github.com/yaqwsx/jlcparts), it won't be in the optimized `db.sqlite3` (and thus jlcsearch won't know about it) until you add it via a script in `lib/db/optimizations/` and then call it in `scripts/setup-db-optimizations.ts`.  You should then do `bun run setup` again to rebuild the optimized database with your new data.  
- If you wish to add additional **component types** (like gyroscopes or Molex connectors) you would need to set up a new schema for them in `lib/db/derivedtables` and then do `bun run generate:db-types` to generate the new table types as per the Development section above.


## Acknowledgements

None of this would be possible without [JLCPCB](https://jlcpcb.com) and the work
[jlcparts](https://github.com/yaqwsx/jlcparts) project.
