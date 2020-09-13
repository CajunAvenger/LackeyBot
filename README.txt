Say hello to LackeyBot, the MSEM Discord bot!

LackeyBot's main function is acting as a card fetching bot. By default, this calls MSEM cards in [[square brackets]], canon Magic cards in <<angle brackets>>, and user uploaded cards in {{curly brackets}}
These databases can be changed per server, leaving LackeyBot also fetching cards for Myriad, Cajun Standard, and public Planesculptors sets.

As this is currently under construction I'm mostly putting stuff for pip here now and will edit the front facing stuff in over time.

lackeybot.js is the primary script. Anything not listed below is likely in there.

arcana.js sets up the different databases, setting them up as arcana.msem, arcana.magic, arcana.myriad, etc
fuzzy.js sets up the fuzzy searching (and scryfall searching) scripts
magic.js sets up the global Magic scripts
packgen.js sets up the pack generator scripts
psScrap.js sets up the scripts for Planesculptors searching

bob.js is the Lackey plugin builder
cannon.js is the Magic database builder
crunch.js is the Comp Rules database builder
freshen.js is the SMS database updater
myriadfix.js is the scripts for patching Myriad files
preview.js is the database builder for sets being previewed
quotedex.js is the quoteDex database and scripts
rick.js is the Cockatrice plugin builder
stitch.js is the main MSEM database updator
>msemupdate.js is the secondary one that I should really add into stitch at some point
untap.js is the Untap database builder

extractor.js is the Set Skeleton extractor
process.js processes decklists for statDex
toolbox.js is utility scripts
web.js has some testing website code

---
Under Construction
---
Arcana Module
matchDex Module
Draft Module
Reminder Module
Roles Module
JustForFun Module
>sms
>$roll
>$emotes
>$prompt
>$minesweeper