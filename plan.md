can you understand how this app work?

i want to build the similar app with latest svelte 5

here's the plan. if you familiar with blender composition window
you will see we have full canvas right

in the canvas we can add node and stack then to each other and in the end there is preview node
like this current app has an output

for a start. i want you to build two node

1. imagenode: that has remove-background button on it
   we can drag n drop image into canvas to create this image node
   or paste image url
   or pasting image that we copy from the internet
   (just like the app i post before)

2. viewernode: this is where stack node output lay
   the output can be configurable: 1280x720 px by default
   and the image on viewer node also update as the viewport canvas background
   just like the blender composition workspace

3. mixnode: same as viewernode. it can receive as many stack image or any node
   also it can output it self to the viewernode input
   so finally we can have multiple stack of node that we can mix and match together

once all done. we also have toggle button NodeMode/EditMode

NodeMode is default mode like we have like the above
in EditMode either way, we need new UI like in photoshop
all node became layer that we can short by dragging the order top to bottom
also each layer can be move/transform just like in photoshop by firstly we select
which node we want to manipulate it scale/ position in the canvas

make the node structure scalable, so it will be easier to add more node later or
ie. hue saturation node, curve node, that can modify the image either from image/mixnode or
any canvas object for that matter
