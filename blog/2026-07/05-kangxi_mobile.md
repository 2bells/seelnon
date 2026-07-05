# Kangxi Mobile

![img](https://i.pinimg.com/736x/ae/fd/ce/aefdcee08c103f4e77ccf68785757c3b.jpg)

Ok, so I tested the whole CN radicals thing on mobile and it was a disaster. It should be more fixed right now. It could've been just the amount of Kangxi being loaded from all .json stuff: 810 and that caused a lot of slow down.

Mainly: just use filters 4head. But there is now a thing that caps amount of shown Kangxi and it should remember the shape of a character, so it doesn't go to a website to request a vector file...

So apparently vectors are not procedurally generated, but it is a community project: 
[Make me Hanzi](https://github.com/skishore/makemeahanzi)

Meaning my app won't fetch .svg if you are offline. Right now it should be cached, but... I didn't test it. In theory by having online connection at least once and making a request for .svg data, it will be kept on your end offline.

[Kangxi App](https://2bells.github.io/seelnon/Content/Projects/scripts/CN_Radicals_json/)

fix only on _json version. Will be sticking to it.

![img](blog/2026-07/img/codes1.jpg)

UPD: it uses a proper database now. It was local storage, but that is 5mb of cache and it is barely enough for all 810 that I have... so just in case it now has indexDB, so everything in the folder on your PC. It has dots to remind you a state a kangxi is according to what you marked it with during 'review' process. Should save all the settings, etc. [dots could be annoying when there are a lot of them... but not the priority. Maybe later I will change it to a 'tint' of a square instead]. Also not sure if inserting your own .json with same number as ID will messup the local storage (there is chance that if you have saved .svg of a character of a specific 'number' and you change the character, it will not update it, because now it is referencing the one offline... just use 'UIDs' in .json arrays, I guess) [maybe more fixes will be coming tho]

## Katex

Also updated Fri-ren notes and this blog to use 'katex' to do this: $E=mc^2$

For 'notes' it is local as well. While Blog is fetching the library online.

```
thought of a day

music is
a harmony extracted
from nature
```

Oh yeah.. Also I saw a rainbow the last day, I thought they went extinct... It was years since the last one for me and not only that I saw the spawn point as well!!! No leprechaun with a pot of gold was spotted, but still. 
I did a few photos and then I heard some people talking that it is a DOUBLE! I look closely... and indeed: it was THE double rainbow, all the way! (It was a bit blocked, but I have my 'believers' rights to think it was the full way)

I would show the photots, but those are classified, sorry. Need proper clerance to show them.