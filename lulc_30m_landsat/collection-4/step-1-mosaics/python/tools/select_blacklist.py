"""
select_blacklist.py

Interactive helper to build the BLACKLIST value of the parameter tables.

It reads a text file with one Landsat image ID per line (for example the
IDs printed in the console by gee/01-0-mapbiomas-ecu-blacklist-path-row.js
or a list of full asset paths), shows them with an index, and lets the user
pick the ones to exclude. It then prints the selection in two formats:
  - as a Python/JavaScript list, to paste into `blackList` in the GEE script;
  - joined with '--', to paste into the BLACKLIST column of the CSV.

Only the last 20 characters of each line are used, which is the Landsat
scene ID (e.g. 'LC08_010059_20250113').

Usage:
    python select_blacklist.py path/to/images.txt

    Then type the index of each image to add and press Enter.
    Type -1 to select all images. Press Enter on an empty line to finish.
"""

import sys

SCENE_ID_LENGTH = 20


def selectBlacklist(filename):
    with open(filename) as file:
        imageList = [line.strip() for line in file if line.strip()]

    for index, image in enumerate(imageList):
        print(index, image[-SCENE_ID_LENGTH:])

    prompt = ('\nType the index of an image to add to the blacklist'
              '\n(-1 = all images, Enter = finish): ')

    selected = []

    while True:
        answer = input(prompt).strip()

        if answer == '':
            break

        try:
            index = int(answer)
        except ValueError:
            print('Not a valid index.')
            continue

        if index == -1:
            selected = list(range(len(imageList)))
            break

        if not 0 <= index < len(imageList):
            print('Index out of range.')
            continue

        if index not in selected:
            selected.append(index)

    blacklist = [imageList[index][-SCENE_ID_LENGTH:] for index in selected]

    print('\nBlacklist for the GEE script:')
    print(blacklist)
    print('\nBlacklist for the CSV (BLACKLIST column):')
    print('--'.join(blacklist))

    return blacklist


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Usage: python select_blacklist.py path/to/images.txt')

    selectBlacklist(sys.argv[1])
