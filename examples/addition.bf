/*
 * ========================================================
 *  Brainfuck Example: Two-Number Addition
 * ========================================================
 *  Adds two numbers (3 + 4 = 7) and outputs the result.
 *
 *  How It Works:
 *    1. Initializes Cell 0 to 3 (+++) and Cell 1 to 4 (++++).
 *       (To add other numbers, simply adjust the '+' counts below!)
 *    2. Performs canonical transfer addition:
 *       [ < + > - ]
 *       Decrements Cell 1 while incrementing Cell 0 until
 *       Cell 1 reaches 0. Cell 0 now holds the sum (7).
 *    3. Mechanical Odometer Carry check:
 *       Counts down the sum from Cell 0 into units (Cell 2).
 *       If the count reaches 10, the tens flag (Cell 3) is
 *       set to 1 and units counter wraps back to 0.
 *    4. Formatted Output:
 *       Prints the tens digit ('1') if sum >= 10, followed
 *       by the units digit ('0' to '9'), and a newline '\n'.
 *
 *  Memory Layout:
 *    Cell 0: First addend (3)   -> holds sum (7), then drained to 0
 *    Cell 1: Second addend (4)  -> 10-countdown carry trigger
 *    Cell 2: Units digit accumulator (0..9)
 *    Cell 3: Tens digit flag (0 or 1)
 *    Cell 4: Zero-check flag for carry condition
 *    Cell 5: Temporary cell for non-destructive copy
 * ========================================================
 */

// Step 1: Initialize Cell 0 = 3 (First number)
+++

// Step 2: Initialize Cell 1 = 4 (Second number)
> ++++

// Step 3: Canonical Transfer Addition: Cell 0 = Cell 0 + Cell 1 (3 + 4 = 7)
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
