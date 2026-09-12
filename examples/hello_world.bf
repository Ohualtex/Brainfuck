/*
 * ========================================================
 *  Brainfuck Example: Hello World!
 * ========================================================
 *  Prints "Hello World!\n" to the output console.
 *
 *  How It Works:
 *    Instead of adding 72 times sequentially for 'H', modern
 *    Brainfuck programs use nested multiplication loops to
 *    initialize ASCII anchor points across the tape.
 *
 *  Memory Layout:
 *    Cell 0: Outer loop counter (8)
 *    Cell 1: Inner factor (4)
 *    Cell 2: Base ~72 for 'H'
 *    Cell 3: Base ~100 for 'e' / 'd'
 *    Cell 4: Base ~108 for 'l' / 'o'
 *    Cell 5: Base ~32 for ' ' (Space)
 *    Cell 6: Base ~10 for '\n' (Newline)
 * ========================================================
 */

// Step 1: Initialize Cell 0 to 8
++++++++

// Step 2: Use nested loop (8 * 4) to populate base ASCII values
[
    > ++++                      // Cell 1 = 4
    [
        > ++                    // Cell 2 += 2 (accumulates 64)
        > +++                   // Cell 3 += 3 (accumulates 96)
        > +++                   // Cell 4 += 3 (accumulates 96)
        > +                     // Cell 5 += 1 (accumulates 32)
        <<<< -                  // Decrement inner counter (Cell 1)
    ]
    > +                         // Cell 2: adjust +1 (total +8) -> 72 ('H')
    > +                         // Cell 3: adjust +1 (total +8) -> 104 ('h')
    > -                         // Cell 4: adjust -1 (total -8) -> 88
    >> +                        // Cell 6: accumulate +8 -> 8
    [<]                         // Scan back to Cell 1
    <-                          // Decrement outer counter (Cell 0)
]

// Step 3: Print "Hello World!\n" with fine-tuning adjustments
>> .                            // Cell 2 (72)            -> 'H'
> --- .                         // Cell 3 (104 - 3 = 101) -> 'e'
+++++++ ..                      // Cell 3 (101 + 7 = 108) -> 'l', 'l'
+++ .                           // Cell 3 (108 + 3 = 111) -> 'o'
>> .                            // Cell 5 (32)            -> ' '
< - .                           // Cell 4 (88 - 1 = 87)   -> 'W'
< .                             // Cell 3 (111)           -> 'o'
+++ .                           // Cell 3 (111 + 3 = 114) -> 'r'
------ .                        // Cell 3 (114 - 6 = 108) -> 'l'
-------- .                      // Cell 3 (108 - 8 = 100) -> 'd'
>> + .                          // Cell 5 (32 + 1 = 33)   -> '!'
> ++ .                          // Cell 6 (8 + 2 = 10)    -> '\n'
