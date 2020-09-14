## LackeyBot
LackeyBot is a Discord bot that handles Magic card fetching as well as a host of general purpose commands as well. LackeyBot's primary prefix is $, for example `$remind 1 hour check the mail`. The ! prefix is used for canon Magic commands, and the ? prefix is used for devDex, the uploadable cards database.

## Card Calling
LackeyBot's main function is acting as a card fetching bot. By default, this calls MSEM cards in `[[square brackets]]` with $commands, canon Magic cards in `<<angle brackets>>` with !commands, and user uploaded cards in `{{curly brackets}}`.

These databases can be changed per server, leaving LackeyBot also fetching cards for Myriad, Cajun Standard, and public Planesculptors sets.

Additionally, you can add $img/!img/?img to your command to show the image instead of the card text, or $rul/!rul/?rul to include any rulings LackeyBot has on it.

When LackeyBot posts the fetched card, it will add a few reactions. X deletes the post, the magnifying glass toggles the card image, the ruler shows any rulings for the card, and the $, !, and ? switch it as though the card had been called in `[[square brackets]]`, `<<angle brackets>>`, or `{{curly brackets}}` respectively, for when you use the wrong ones.
![Reaction image](https://cdn.discordapp.com/attachments/443557716842250240/754859046389022790/unknown.png)

### Other LackeyBot Magic commands:
Command | Description
------- | -----------
`<<Card Name>>` | Returns the card text of Card Name, or the closest thing LackeyBot's fuzzy search finds
`<<Card Name_SET|(Scryfall query)` | Optional filters. _SET prioritizes cards that are in that set, useful for pulling particular reprints. Scryfall queries after a pipe filter out all cards that don't match the query.
!codes | Returns an embed of all set codes for the database
!stat SET | Returns some stats for the given set code
!open SET | Opens a pack of the given set code in an embed only the command-sender can interact with
!p1p1 SET | Opens a pack of the given set displayed as a list for Pack 1 Pick 1 discussion
!search (Scryfall query) | Creates a link to Scryfall (or equivalent) with your search terms. Also creates an embed of the cards it found that match the search, but note this may not always line up with the site's results due to database differences.
!scry (Scryfall query) | The same as above, but with an alternate name due to conflict with Rhythm.
!ban (format) | Returns the banlist of the given format.
!random (optional Scryfall query) | Returns a random card, that matches the scryfall query if given
!cr (rule number or mechanic) | Returns the given CR citation or pulls it for the given mechanic
!img | Returns the images of the last card, or posts the card image when used with a card fetch
!rul | Returns the rulings of the last card, or posts the rulings with the card image when used with a card fetch 

## Reminders
LackeyBot's reminder command lets you set any number of reminders for (most) any length of time, and accepts fractional times.

When confirming a reminder, LackeyBot will react with a star, and anyone who reacts with the star will also be pinged when the reminder fires.

After the reminder fires, LackeyBot will add more reactions allowing you to snooze the reminder for an hour, a day, a week, or a repeat duration without needing to redo the command.
Command | Description
------- | -----------
$remind # (time) (message) | Sets a reminder for # time from now. Accepts seconds, s, minutes, min, m, hours, h, hr, day, d, week, wk, w, month, year, yr, and decade. A blank message will also be accepted
$remind (event) message | Sets a reminder for a predetermined event, for example `$remind Zendikar Landfall will return` to make prediction reminders.
$remind event | Returns list of events that have been set 
$reminderlist | Returns a full list of your reminders
$reminderdelete N | After a reminderlist, reminders can be deleted with this command, using the number provided with $reminderlist. If you delete multiple reminders, the numbers will remain the same as listed in $reminderlist until you call the command again

## Roles
LackeyBot supports user-assignable roles, including inrole counts and exclusive groups, where a user can only have one role from a list, such as for color roles.
Command | Description
------- | -----------
$roles | List of self-assignable roles
$lsar | Same as above
$iam RoleName | Gives the user a given role, or takes it away if they have it
$iamnot RoleName | Removes a role from the user if they have it
$iamn RoleName | Same as above
$inrole RoleName | Returns an embed of users in a self-assignable role
$role setup | Used to initialize the server's role database
$role help | A help menu for admins to set up roles

## matchDex
LackeyBot has tournament running support, including automatic deck checks and Swiss pairing
Command | Description
------- | -----------
$submit tournament (deckName) (Decklist contents) | Submits a decklist to a tournament
$report tournament X-Y @Opponent | Submits a match report where the user won X games and the Opponent won Y games
$report tournament match # X-Y @Opponent | Edits a match report where the user won X games and the Opponent won Y games. LackeyBot supplies the match number when it confirms a match
$(tournament)leader | Displays the leaderboard of the tournament
$league | Returns info on current league run, or the league help message
$league # | Returns info on an older league run with the given number
$matches | Returns user's match information
$foes | Returns list of league opponents the user can play
$vsseeker | Same as above.

## Other commands
Command | Description
------- | -----------
$roll | Rolls a 20 sided die
$roll YdX | Rolls Y X sided dice. Supports adding dice, `$roll 2d6 + 2d10 + 2` Both cap at 100.
khN, klN, e | Keep high N, Keep low N, or exploding dice. `$roll 2d20kh1`
$minesweeper | Generates a minesweeper game. Can generate bigger/smaller boards with `$minesweeper N`
$shuffle # | Returns a shuffled list of numbers 1 through #
$prompt | Gives a random design prompt from Chartate101
$namegen | Generates a random name. Supports up to `$namegen 15`
!hm (easy/medium/hard) | Generates a Magic card hangman game
$bigemoji (emoji) | Posts a big version of the given custom emoji
$avatar (userID) | Posts users avatar, or the given user's avatar
$userinfo | Posts info about the user
$serverinfo | Posts info about the server
$play | Changes LackeyBot's playing message
$stats | Returns LackeyBot's power level
$self-destruct | Causes LackeyBot to explode
$dance | Causes LackeyBot to dance
$amoeboid | Amoeboid reaction
$barbaric | Barbaric reaction
$fblthp | Fblthp reaction
$maro | Maro reaction
$mklthd | Mklthd reaction
$sponge | SpongeBob reaction
$starter | Kit reaction
$thonk | Thonk reaction
$x | Doubt reaction

## Stuff for coders

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

msemupdate.js is the secondary one that I should really add into stitch at some point

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