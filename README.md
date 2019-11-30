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
- Moving:
    - Use the key to move the selected primitive:
        - `w`: forward
        - `a`: backward
        - `s`: left
        - `d`: right
        - `q`: up
        - `e`: down
    - Use the key to move root forward/backward/left/right/up/down.
        - `W`: forward
        - `A`: backward
        - `S`: left
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

# Browser Tested

Chrome Version 79.0.3945.29 (Official Build) beta (64-bit)
