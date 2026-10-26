# Sound sources (CC0 / public domain only)

Game files in `public/mafia/sfx/` were trimmed and re-encoded (mono MP3) from the files listed below.

All files in `raw/` are byte-for-byte copies of the files in the repos below. Nothing was converted or trimmed.
Everything was fetched with `git clone --depth 1` on 2026-10-25. The commits used are:

| Key | Repo | Commit |
|---|---|---|
| LAV | https://github.com/lavenderdotpet/CC0-Public-Domain-Sounds | f2b6264f9ab89fabc266914c3654685d68c5a39b |
| ANIM | https://github.com/S3Electronics/anim-sounds | b581477212acbead61dbd1258675f1c389c27733 |
| DIEG | https://github.com/parijjana/diegema | cab5cea728bcf6f723c6a23dccf406c6a11ebe73 |

## Where each repo states its license (quoted)

- **LAV, repo root `LICENSE`**: the full CC0 legal code. It opens with: `Creative Commons Legal Code` / `CC0 1.0 Universal`.
- **LAV, Kenney packs**: each Kenney folder keeps Kenney's own `License.txt`.
  - `kenney_casinoaudio/License.txt`: "Casino Audio … by Kenney Vleugels (Kenney.nl) … License (Creative Commons Zero, CC0) http://creativecommons.org/publicdomain/zero/1.0/ … You may use these assets in personal and commercial projects. Credit (Kenney or www.kenney.nl) would be nice but is not mandatory."
  - `kenney_uiaudio/License.txt`: "License (Creative Commons Zero, CC0) http://creativecommons.org/publicdomain/zero/1.0/"
  - `kenney_interfacesounds/License.txt`: "Interface Sounds (1.0) Created/distributed by Kenney (www.kenney.nl) … License: (Creative Commons Zero, CC0) http://creativecommons.org/publicdomain/zero/1.0/"
  - `kenney_impactsounds/License.txt`: "Impact Sounds (1.0) Created/distributed by Kenney (www.kenney.nl) … License: (Creative Commons Zero, CC0)"
  - `kenney_rpgaudio/License.txt`: "RPG Audio by Kenney Vleugels (Kenney.nl) … License (Creative Commons Zero, CC0)"
- **LAV, `100-CC0-wood-metal-SFX/`**: rubberduck's OpenGameArt pack "100 CC0 metal and wood SFX". The folder has no license file of its own, so it rests on the repo-root CC0 `LICENSE` and the "CC0" in the pack name.
- **LAV, `bb - Books, Paper, Writing (Jan 2021)/_README.txt`** (Ben Burnes / Abstraction): "These sounds are public domain (Creative Commons 0). You are free to enhance, reuse, remix, or do whatever with these files."
- **ANIM, `README.md`**: "ทุกไฟล์เป็น CC0 (public domain) จาก Freesound ผ่าน Openverse ใช้ได้ทุกงาน รวมถึงเชิงพาณิชย์ ไม่ต้องให้เครดิต". In English: "Every file is CC0 (public domain), from Freesound via Openverse. Usable for any work, including commercial, no credit needed."
  - `catalog.json` also carries `"license": "CC0"` and the Freesound source URL for every entry.
  - The README says the files were loudness-normalised to -16 LUFS and cut to 10 s or less.
  - The repo has no separate LICENSE file.
- **DIEG, `assets/ambience/CREDITS.md`**: a table with a licence for each file. It also says: "Each clip's own page states "License CC0 (public domain)" and names its author" and "BigSoundBank releases its sounds under CC0 1.0 Universal (also WTFPL / public domain dedication): <https://bigsoundbank.com/droit.html>".
  - The repo `LICENSE` is MIT, which covers the code.
  - The clips were trimmed by Diegema's script into seamless loops and encoded as AAC.

## Files

| Our name | Repo | Original file path | Original source / author | License, and where it is stated |
|---|---|---|---|---|
| card_shuffle.ogg | LAV | kenney_casinoaudio/Audio/cardShuffle.ogg | Kenney, Casino Audio | CC0: kenney_casinoaudio/License.txt "License (Creative Commons Zero, CC0)" |
| card_slide.ogg | LAV | kenney_casinoaudio/Audio/cardSlide1.ogg | Kenney, Casino Audio | CC0: same as above |
| card_flip.ogg | LAV | kenney_casinoaudio/Audio/cardPlace1.ogg | Kenney, Casino Audio | CC0: same as above |
| chips.ogg | LAV | kenney_casinoaudio/Audio/chipsStack1.ogg | Kenney, Casino Audio | CC0: same as above |
| click.ogg | LAV | kenney_uiaudio/Audio/click1.ogg | Kenney, UI Audio | CC0: kenney_uiaudio/License.txt "License (Creative Commons Zero, CC0)" |
| select.ogg | LAV | kenney_interfacesounds/Audio/confirmation_001.ogg | Kenney, Interface Sounds | CC0: kenney_interfacesounds/License.txt "License: (Creative Commons Zero, CC0)" |
| error.ogg | LAV | kenney_interfacesounds/Audio/error_006.ogg | Kenney, Interface Sounds | CC0: same as above |
| gavel.ogg | LAV | kenney_impactsounds/Audio/impactWood_heavy_000.ogg | Kenney, Impact Sounds | CC0: kenney_impactsounds/License.txt "License: (Creative Commons Zero, CC0)" |
| timer_end_bell.ogg | LAV | kenney_impactsounds/Audio/impactBell_heavy_000.ogg | Kenney, Impact Sounds | CC0: same as above |
| footstep.ogg | LAV | kenney_impactsounds/Audio/footstep_wood_000.ogg | Kenney, Impact Sounds | CC0: same as above |
| coins.ogg | LAV | kenney_rpgaudio/Audio/handleCoins.ogg | Kenney, RPG Audio | CC0: kenney_rpgaudio/License.txt "License (Creative Commons Zero, CC0)" |
| door_close.ogg | LAV | kenney_rpgaudio/Audio/doorClose_1.ogg | Kenney, RPG Audio | CC0: same as above |
| gavel_alt.ogg | LAV | 100-CC0-wood-metal-SFX/wood_hammer_01.ogg | rubberduck, OpenGameArt "100 CC0 metal and wood SFX" | CC0: repo-root LICENSE "CC0 1.0 Universal" (pack name says CC0) |
| pen_scribble.wav | LAV | bb - Books, Paper, Writing (Jan 2021)/Mech Pencil Scribbles.wav | Ben Burnes (Abstraction) | CC0: _README.txt in that folder, "These sounds are public domain (Creative Commons 0)." |
| gunshot.mp3 | ANIM | sfx/gun_shot_2.mp3 | Freesound #248204 "Five seveN gun shot and silenced.wav" by mnslugger20, https://freesound.org/people/mnslugger20/sounds/248204 | CC0: README (above) + catalog.json `"license": "CC0"` |
| heartbeat.mp3 | ANIM | sfx/heartbeat_1.mp3 | Freesound #22416 "Four Heartbeats HQ_BeatSmith.wav" by Lunardrive | CC0: same as above |
| tension_hit.mp3 | ANIM | sfx/horror_stinger_3.mp3 | Freesound #460042 "Piano Shock Impact" by DianneTriplerUne | CC0: same as above |
| win_jingle.mp3 | ANIM | sfx/ta_da_1.mp3 | Freesound #127907 "-Hero_of_the_Winds-_Ta-Da_1.wav" by -Hero_of_the_Winds- | CC0: same as above |
| lose_jingle.mp3 | ANIM | sfx/fail_trombone_1.mp3 | Freesound #175409 "wah wah sad trombone.wav" by kirbydx | CC0: same as above |
| clock_tick.mp3 | ANIM | sfx/ticking_2.mp3 | Freesound #212181 "Loopable Ticking Clock" by OwlStorm | CC0: same as above |
| timer_end_buzzer.mp3 | ANIM | sfx/wrong_buzzer_3.mp3 | Freesound #164089 "buzzer2.wav" by hypocore | CC0: same as above |
| rooster.mp3 | ANIM | sfx/rooster_2.mp3 | Freesound #200339 "Rooster crow" by jsbarrett | CC0: same as above |
| gasp.mp3 | ANIM | sfx/gasp_1.mp3 | Freesound #344407 "Male Gasp 1.wav" by jawbutch | CC0: same as above |
| whoosh.mp3 | ANIM | sfx/whoosh_1.mp3 | Freesound #60026 "Swosh swoosh whoosh air sound" by qubodup | CC0: same as above |
| typing.mp3 | ANIM | sfx/typing_keyboard_2.mp3 | Freesound #79388 "keyboard_typing.wav" by j1987 | CC0: same as above |
| night_ambience.m4a | DIEG | assets/ambience/night_crickets.m4a | BigSoundBank "Campaign at Night #4" by Joseph Sardin, https://bigsoundbank.com/campaign-at-night-4-s1880.html | CC0: CREDITS.md row "`night_crickets.m4a` … Joseph Sardin \| CC0 1.0" |
| day_ambience.m4a | DIEG | assets/ambience/forest.m4a | BigSoundBank, Joseph Sardin (CREDITS.md names no specific page) | CC0: CREDITS.md row "`forest.m4a` \| BigSoundBank, Joseph Sardin (bigsoundbank.com) \| CC0 1.0" |
| crowd_murmur.m4a | DIEG | assets/ambience/tavern_crowd.m4a | BigSoundBank "Crowd of 50-60 People #2" by Joseph Sardin, https://bigsoundbank.com/crowd-of-50-60-people-2-s3516.html | CC0: CREDITS.md row "`tavern_crowd.m4a` … Joseph Sardin \| CC0 1.0" |

## Notes and caveats

- **ANIM and DIEG are third-party mirrors.** For Freesound and BigSoundBank items we rely on the CC0 statement those repos make. The original Freesound or BigSoundBank pages could not be opened from this container to double-check.
- **gunshot.mp3** has two shots: one at about 0.00–0.47 s and one at about 1.50–1.98 s. The source title is "gun shot and silenced", so one of them is the suppressed shot. Which one was not checked by ear; trim to the one you want.
- **win_jingle.mp3 and lose_jingle.mp3** were chosen by their titles ("Ta-Da", "sad trombone"). The lose sound is comic rather than dark. For a darker cue, use tension_hit.mp3 (a piano shock impact).
- **Ambience loops:** night_ambience, day_ambience and crowd_murmur are each 72 s of AAC and just under 1 MB. Diegema says they were cut as seamless loops. They are .m4a, not .ogg; re-encode if needed.
- **pen_scribble.wav** is uncompressed WAV (530 KB). It is worth encoding to .ogg.
- **Kenney UI sounds** (click, select, error) are designed UI sounds from Kenney's packs. The casino, impact and RPG sounds are Foley recordings.
- **Rejected or not used:**
  - wyzowl/sfx-kit: CC0, but every sound is synthesised by code.
  - Fris0uman/CDDA-Soundpacks: repo license is CC-BY-SA; only some files are CC0 per file.
  - samerhanze/IEC10-new-sounds: ESC-10 data, CC-BY-NC.
  - nocs32/bluff-table: has CC0-sourced shuffle, heartbeat and revolver cuts, but the repo has no license of its own.
  - rafaelmardojai/blanket: birds.ogg (CC0) is 3 MB.
  - sinaida-space/infinite-voidsong: CC0 BigSoundBank birds, but the repo content is CC BY-NC-ND.
  - The Loppansson Godot mirrors of Kenney packs no longer exist.
| sniper.mp3 | ANIM + LAV | sfx/gun_shot_1.mp3 + 25-CC0-bang-sfx/cannon_01.ogg | gun_shot_1: Freesound #484036 "Rifle Gun Shot 02.wav" by MATRIXXX_; cannon_01: rubberduck, OpenGameArt "25 CC0 bang / firework sfx" | CC0: ANIM README + catalog.json `"license": "CC0"`; LAV repo-root LICENSE "CC0 1.0 Universal". Layered (rifle pitched down + low-passed cannon), compressed and limited for the assassination shot. |
