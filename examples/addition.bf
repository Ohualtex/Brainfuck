[
  Adds two small numbers: 3 + 4 = 7
  Cell 0: 3
  Cell 1: 4
  Result stored in Cell 1: 7
]

+++       Set Cell 0 to 3
> ++++    Set Cell 1 to 4
<         Move back to Cell 0

[         While Cell 0 != 0
  -       Decrement Cell 0
  > +     Increment Cell 1
  <       Move back to Cell 0
]

>         Move to Cell 1 (contains 7)
