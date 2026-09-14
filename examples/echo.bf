/*
 * ========================================================
 *  Brainfuck Example: Interactive Character Echo
 * ========================================================
 *  Reads characters from standard input and echoes them
 *  directly to output until End-of-File (EOF = 0).
 *
 *  How It Works:
 *    1. Reads first character into Cell 0 with ','
 *    2. Enters loop while Cell 0 is not zero (EOF)
 *    3. Prints character with '.'
 *    4. Reads next character with ','
 *    5. Terminates cleanly without trailing null bytes
 *
 *  Memory Layout:
 *    Cell 0: Input / Output character buffer
 * ========================================================
 */

// Read first character from input into Cell 0
,

// Loop while character is not EOF (value != 0)
[
    .       // Echo character to output
    ,       // Read next character from input
]
