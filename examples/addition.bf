/*
 * ========================================================
 *  Brainfuck Example: Universal Two-Number Adder
 * ========================================================
 *  Takes any two single-digit numbers from standard input,
 *  calculates their exact sum (0 to 18), and prints the
 *  formatted result followed by a newline!
 *
 *  Examples:
 *    Input: "34" -> Output: "7\n"
 *    Input: "78" -> Output: "15\n"
 *    Input: "99" -> Output: "18\n"
 *    Input: "05" -> Output: "5\n"
 *    Input: "00" -> Output: "0\n"
 *
 *  How It Works:
 *    1. Reads first digit character from input via ','
 *       and converts from ASCII to number by subtracting 48.
 *    2. Reads second digit character from input via ','
 *       and converts from ASCII to number by subtracting 48.
 *    3. Performs canonical transfer addition: [ < + > - ]
 *       so Cell 0 holds the raw sum S (0 to 18).
 *    4. Mechanical Counter / Odometer carry check:
 *       Counts down from S. If the counter reaches 10,
 *       the tens flag is set to 1 and the units counter
 *       is wrapped back to 0.
 *    5. Outputs the tens digit ('1') if present, followed
 *       by the units digit ('0' to '9'), and a newline '\n'.
 *
 *  Memory Layout:
 *    Cell 0: Input 1 / Sum accumulator S (0..18)
 *    Cell 1: Input 2 / 10-countdown carry trigger
 *    Cell 2: Units digit accumulator (0..9)
 *    Cell 3: Tens digit flag (0 or 1)
 *    Cell 4: Zero-check flag for carry condition
 *    Cell 5: Temporary cell for non-destructive copy
 * ========================================================
 */

// Step 1: Read first digit and convert from ASCII ('0' = 48) to integer
,
> ++++++ [ < -------- > - ] <

// Step 2: Read second digit and convert from ASCII ('0' = 48) to integer
>,
> ++++++ [ < -------- > - ] <

// Step 3: Canonical Transfer Addition: Cell 0 = Cell 0 + Cell 1
[ < + > - ] <

// Step 4: Split sum S (in Cell 0) into Tens (Cell 3) and Units (Cell 2)
// Uses an odometer countdown: Cell 1 starts at 10
> ++++++++++ <
[
    -                   // Decrement sum S
    > -                 // Decrement 10-countdown (Cell 1)
    > +                 // Increment units digit (Cell 2)
    >> +                // Set zero-check flag (Cell 4 = 1)
    <<< [ >>>> + > + <<<<< - ] >>>>> [ <<<<< + >>>>> - ] // Copy Cell 1 to Cell 5
    < [ < - > [-] ]     // If Cell 5 != 0, reset flag Cell 4 = 0
    < [                 // If Cell 4 == 1 (Cell 1 hit 0 -> sum reached 10!):
        < +             //   Set Tens digit (Cell 3 = 1)
        < [-]           //   Reset Units digit (Cell 2 = 0)
        < +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ // Prevent re-triggering
        >>> [-]         //   Clear flag (Cell 4 = 0)
    ]
    <<<<                // Return to Cell 0
]

// Step 5: Print Tens digit ('1') if sum >= 10
>>>
[
    > ++++++ [ < ++++++++ > - ] < .  // Convert 1 to ASCII '1' (49) and print
    [-]                              // Clear Cell 3
]

// Step 6: Print Units digit ('0' .. '9')
<
> ++++++ [ < ++++++++ > - ] < .      // Convert units (0..9) to ASCII ('0'..'9') and print
< [-]                                // Clear Cell 2

// Step 7: Print newline '\n' (ASCII 10)
++++++++++ .
