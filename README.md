- [Sky scene](https://laurence6.github.io/WebGL-demo/index.html)
- [Mountain scene](https://laurence6.github.io/WebGL-demo/mountain.html)
- [Ohio State University Dreese Lab scene](https://laurence6.github.io/WebGL-demo/dreese.html)
  - View on [Google Maps](https://www.google.com/maps/place/Dreese+Lab/@40.0027346,-83.016035,18.54z/data=!4m8!1m2!3m1!2sDreese+Lab!3m4!1s0x88388e96732423c1:0xc18a2f8aed8d8b53!8m2!3d40.0022856!4d-83.0158697)
- [Debug scene](https://laurence6.github.io/WebGL-demo/debug.html)

The initial scene is divided into tiles. Each tile has a randomly generated object.

There are six possible rendering modes for objects: light only, texture only, light + texture, light + bump, light + texture + bump, cubemap.

Objects have three drawing modes: fill (triangle), line, and point.

A point light source follows the camera to the nearest tile and rotate around the center of the tile.

# Usage

- Hierarchy tree:
    - Displayed at the left of the page.
    - Selected primitive have `<-` on the right.
- Selected primitive:
    - After creating a new primitive, it becomes the current selected primitive.
    - Use up/down arrow key to go up/down in the hierarchy tree.
    - Use left/right arrow key to move among the siblings.
- Creating new primitives:
    - Click buttons and enter parameters to create a new cube/cylinder/sphere/model.
    - Newly created primitive will be the child of the selected primitive and placed at `(0, 1, 0)` position relative to the selected primitive.
- Deleting the selected primitive:
    - Click `Delete` button.
    - Use `Delete` key.
- Moving:
    - Use the key to control the camera:
        - `w`: move forward
        - `s`: move backward
        - `a`: rotate left
        - `d`: rotate right
        - `q`: rotate down
        - `e`: rotate up
    - Use the key to move root forward/backward/left/right/up/down.
        - `W`: forward
        - `S`: backward
        - `A`: left
        - `D`: right
        - `Q`: up
        - `E`: down
    - Click `Translate` button, then hold and move mouse left/right to move on the current axis.
- Rotating:
    - Click `Rotate` button, then hold and move mouse left/right to rotate about the current axis.
    - For camera only:
        - Use `P/p` to adjust pitch.
        - Use `Y/y` to adjust yaw.
        - Use `R/r` to adjust roll.
- Scaling:
    - Click `Scale` button, then hold and move mouse left/right to scale on the current axis.
- Setting the current axis to translate/rotate/scale:
    - Click `X`, `Y`, `Z` buttons.
- Setting the selected primitive's color:
    - Pick a color and click `Set Color` button.
- Setting the light's color:
    - Pick a color and click `Set Light Color` button.
- Setting the drawing mode:
    - Click `Fill`, `Line`, `Point` buttons.
- Setting the rendering mode:
    - Click `Light`, `Texture`, `Light+Texture`, `Light+Bump`, `Light+Texture+Bump`, `Cube Mapping` buttons.

# Browser Tested

Chrome Version 79.0.3945.45 (Official Build) beta (64-bit)
