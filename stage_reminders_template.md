# BrewMate: Stage Reminders Template & Master Inventory

| Stage Number | Stage Name | Stage Code | Task ID | Current Label | Timing / Trigger | Action | Proposed New Label | Proposed Pop-up Explanation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Strike Water | STRIKE | strike-sparge-vol | Liquor [X]L / [Y]L | Stage start | Keep | Liquor [X]L / [Y]L | Verify liquor volumes |
| 1 | Strike Water | STRIKE | water-treat | Treat water | Stage start | Rename | Water salts | Add gypsum, calcium chloride, and acid into strike liquor |
| 1 | Strike Water | STRIKE | fv-cooler-on | FV cooling on | Stage start | Keep | FV cooling on | Switch on glycol chiller for fermenter to pre-cool |
| 2 | Mash In | MASH-IN | mash-temp-init | Check mash temp [X]°C | Stage start | Keep | Check mash temp [X]°C | Don’t add enzymes until target temp reached |
| 2 | Mash In | MASH-IN | mash-additions-check | Mash additions | Stage start | Keep | Mash additions | Add enzymes, or lactic acid |
| 2 | Mash In | MASH-IN | dough-ball-check | No dough balls | Stage start | Keep | No dough balls | Thoroughly stir the mash, checking corners for dry clumps |
| 2 | Mash In | MASH-IN | dough-in-flow | Mash in | Stage start | Remove | — | Begin doughing in grain |
| 3 | Mash Rest | MASH | mash-temp-stable | Hold mash temp | Stage start | Rename | Check mash temp [X]°C | Verify temp rest mash step |
| 3 | Mash Rest | MASH | ph-sample | pH check (~5.2) | 15m into mash | Keep | pH check (~5.2) | Cool wort sample to 20°C and verify mash pH is 5.2–5.4 |
| 3 | Mash Rest | MASH | iodine-test | Iodine test | 45m into mash | Remove | — | Drop wort onto chalk tile with iodine; verify no starch reaction |
| 3 | Mash Rest | MASH | vorlauf-check | Vorlauf | Timed alert (~60m into mash) | Keep | Vorlauf | Begin slow vorlauf recirculation until wort runs clear in sight glass |
| 4 | Lauter & Sparge | LAUTER | sparge-prep | Sparge [X]°C | Stage start | Keep | Sparge [X]°C | Verify sparge liquor in HLT is heated to 78–80°C |
| 4 | Lauter & Sparge | LAUTER | equal-flow | Even flow | Continuous | Keep | Even flow | Balance runoff rate with sparge inflow to prevent bed compaction |
| 4 | Lauter & Sparge | LAUTER | kettle-early-heat | Kettle heat on | Once elements covered | Keep | Kettle heat on | Turn on small kettle element as soon as it is submerged |
| 4 | Lauter & Sparge | LAUTER | runoff-gravity-cutoff | Stop before 1.010 | Runoff tail | Keep | Stop before 1.010 | Test runnings gravity; halt sparge if below 1.010 to prevent tannin extraction |
| 4 | Lauter & Sparge | LAUTER | preboil-vol | Pre-boil volume [X]L | End of sparge | Keep | Pre-boil volume [X]L | Measure total volume collected in boil kettle before boil |
| 4 | Lauter & Sparge | LAUTER | preboil-sg | Pre-boil SG [X] | End of sparge | Keep | Pre-boil SG [X] | Take sample and record pre-boil gravity |
| 4 | Lauter & Sparge | LAUTER | hot-break-ramp | Ramp to boil | Pre-boil ramp | Keep | Ramp to boil | Bring kettle to rolling boil; prepare defoamer to control hot-break foam |
| 5 | Boil | BOIL | rolling-boil | Rolling boil | Stage start | Keep | Rolling boil | Confirm vigorous rolling boil established before starting timer |
| 5 | Boil | BOIL | boil-additions-monitor | Additions | Throughout boil | Keep | Additions | Check Additions tab for timed kettle hops, sugars, and finings |
| 5 | Boil | BOIL | whirlpool-prep | Sanitise whirlpool loop | T-15m to flameout | Remove | — | Recirculate boiling wort through heat exchanger, pump and piping to heat-sanitize |
| 5 | Boil | BOIL | steam-heat-off | Heat off at flameout | At 00:00 | Keep | Heat off at flameout | Cut kettle heating immediately at flameout |
| 6 | Whirlpool | WHIRLPOOL | cut-heat | Heat off | Stage start | Keep | Heat off | Verify heating elements are fully turned off |
| 6 | Whirlpool | WHIRLPOOL | whirlpool-additions | Whirlpool additions | Stage start | Keep | Whirlpool additions | Add aroma hopstand pellets/extract at designated whirlpool temp |
| 6 | Whirlpool | WHIRLPOOL | vortex-spin | Spin | First 5-10m | Keep | Spin | Run pump at full speed to create strong vortex, then shut pump off |
| 6 | Whirlpool | WHIRLPOOL | settle-cone | Settle cone | Last 10-15m | Keep | Settle cone | Let kettle sit completely undisturbed to allow trub and hop cone to settle |
| 7 | Cooling Recirc | CHILL | hx-hot-sanitize | Sanitise loop | Stage start | Keep | Sanitise loop | Recirculate hot wort through heat exchanger loop without cooling water |
| 7 | Cooling Recirc | CHILL | cooling-medium-on | Cooling on | Stage start | Keep | Cooling on | Open mains cooling supply valve to heat exchanger |
| 7 | Cooling Recirc | CHILL | temp-goal-60 | Chill to 60°C | Continuous | Keep | Chill to 60°C | Monitor recirc temp until core kettle reaches target 60°C |
| 7 | Cooling Recirc | CHILL | transfer-line-prep | Align valves | At 60°C | Rename | Transfer hose | Transfer hose from chiller outlet toward fermenter inlet |
| 8 | Knockout | KNOCKOUT | start-aeration | Aeration on | Transfer start | Keep | Aeration on | Turn on sterile inline oxygen / aeration stone at designated LPM |
| 8 | Knockout | KNOCKOUT | chiller-exit-temp | Exit temp [X]°C | Continuous | Keep | Exit temp [X]°C | Check dial thermometer at chiller outlet to ensure wort enters FV at pitch temp |
| 8 | Knockout | KNOCKOUT | postboil-sg | Record OG | Mid-transfer | Keep | Record OG | Pull cooled sample from FV port and log original gravity |
| 8 | Knockout | KNOCKOUT | trub-cutoff | Stop at trub | Transfer end | Keep | Stop at trub | Watch sight glass; stop transfer pump as soon as trub cone breaks |
| 8 | Knockout | KNOCKOUT | fv-volume-check | FV volume [X]L | Transfer end | Keep | FV volume [X]L | Verify final volume into fermenter |
| 9 | Yeast Pitch | PITCH | temp-confirm | Pitch temp [X]°C | Stage start | Keep | Pitch temp [X]°C | Verify fermenter probe reads <= pitch temp before pitching yeast |
| 9 | Yeast Pitch | PITCH | pitch-additions | Yeast + aids | Stage start | Keep | Yeast + aids | Dose yeast slurry/brink, ALDC enzyme, and oxygenation aids into FV |
| 9 | Yeast Pitch | PITCH | seal-fv | Seal FV | Stage start | Remove | — | Clamp top manway, install sanitized blowoff tube or spunding valve |
| 9 | Yeast Pitch | PITCH | temp-controller-set | Set controller [X]°C | Stage start | Keep | Set controller [X]°C | Set fermenter temperature controller to target primary setpoint - check the temp probe! |
| 10 | Clean Up | CLEANUP | spent-grain-dump | Spent grain out | Post-brew | Keep | Spent grain out | Dig out mash tun spent grains into bins bags |
| 10 | Clean Up | CLEANUP | chiller-backflush | Backflush chiller | Post-brew | Keep | Backflush chiller | Reverse flush heat exchanger with hot water to dislodge hop matter |
| 10 | Clean Up | CLEANUP | brewhouse-cip | CIP | Post-brew | Remove | — | Circulate hot caustic / PBW wash through kettles and pipework |
| 10 | Clean Up | CLEANUP | sanitizer-flush | Sanitiser flush | Post-brew | Remove | — | Rinse all vessels with fresh water and flush lines with peracetic acid |
| 10 | Clean Up | CLEANUP | session-audit | Review log | Post-brew | Remove | — | Open Session Audit Report to review efficiency, timestamps, and export report |
