# CN Factor

So, in the long past of ancient times [yesterday] I was like: it is pretty much .json. And then I thought to myself: why not make it .json? So I did. Along with some refactoring and me having a pain for not being able to properly import from an array to reference imports... so procedural imports even of .json is a bit rough on a 'static' website.

![img](https://www.dropbox.com/scl/fi/kyadt9jrn4bvza09yuaht/midnight-refactor.jpg?rlkey=8bywxy8msemeq47i2hy021699&st=d92e4b47&raw=1)

It was solved by the 'URL' injections. Some other methods didn't want to work here [Github Pages] even though it was referencing the right file.
But the main thing: the whole .js was a bit messy and me bragging: 'how easy it is to inject new data into it'... it didn't sit right with the stuff that needed to be done in order to inject new data in the first place.

So now it is:
- add .json file with your list/array of words
- go to import.js
- write the name of the .json file inside data/
- works
- if creating more folders, it should work as well with your_folder/file_name

It creates url based on the relative environment and just reads your .json, sends it to the constructor and everything unpacks neetly. It is a basic string injection: `./data/${fileName}.json` so running me/my/mine/lady.json should work with no problems.

But there could be 'number' conflicts, so that is to pay attention to.

[Learn Kangxi](https://2bells.github.io/seelnon/Content/Projects/scripts/CN_Radicals_json/)

```
thought of a day

ty ty
```