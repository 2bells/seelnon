# Operation Nodes

> Type notation: `[int]`, `[float]`, `[bool]`, `[generic]`, `[enum]`, `[3D Vector]`, `[list]`, `[dict]`, `[struct]`.

---

## I. General

### 1. Enumerations Equal

**Function:**  
After confirming the Enumeration type, determines whether the two input values are equal.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Enumeration 1 | `[generic]` | |
| Input | Enumeration 2 | `[generic]` | |
| Output | Result | `[bool]` | Output `True` if equal, `False` if not equal |

---

### 2. Assembly List

**Function:**  
Assembles multiple Input Parameters of the same type (up to 100) into a single List.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | 0~99 | `[generic]` | Assembles up to 100 parameters into a list |
| Output | List | `[generic]` | The assembled list |

---

### 3. Equal

**Function:**  
Determines whether two inputs are equal.

Some Parameter Types have special comparison rules:

- **Floating Point Numbers:** Compared using approximate equality. When the difference between two Floating Point Numbers is less than an extremely small value, the two numbers are considered equal.  
  Example: `2.0000001` and `2.0` are considered equal.
- **3D Vector:** The x, y, and z components are compared using Floating Point approximate equality.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Input 1 | `[generic]` | |
| Input | Input 2 | `[generic]` | |
| Output | Result | `[bool]` | Output `True` if equal, `False` if not equal |

---

### 4. Data Type Conversion

**Function:**  
Converts input parameter types to another type for output. For specific rules, see Basic Concepts - [Conversion Rules Between Basic Data Types].

Floating point numbers are rounded to integers when converted.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Input | `[generic]` | |
| Output | Output | `[generic]` | |

---

## II. Math

### 1. Split 3D Vector

**Function:**  
Outputs the x, y, and z components of a 3D Vector as three Floating Point Numbers.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | 3D Vector | `[3D Vector]` | |
| Output | X-Component | `[float]` | |
| Output | Y-Component | `[float]` | |
| Output | Z-Component | `[float]` | |

---

### 2. Multiplication

**Function:**  
Performs multiplication, supporting Floating Point and Integer multiplication.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Generic | `[generic]` | |
| Input | Generic | `[generic]` | |
| Output | Result | `[generic]` | |

---

### 3. Division

**Function:**  
Performs division, supporting Floating Point division and Integer division. Integer division returns the quotient result.

- The divisor should not be `0`, otherwise it may return an illegal value.
- When the divisor is `0`, the result is `0`.
- `-2147483648` divided by `-1` results in `0`.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Generic | `[generic]` | |
| Input | Generic | `[generic]` | |
| Output | Result | `[generic]` | |

---

### 4. Create 3D Vector

**Function:**  
Creates a 3D Vector from x, y, and z components.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | X-Component | `[float]` | |
| Input | Y-Component | `[float]` | |
| Input | Z-Component | `[float]` | |
| Output | 3D Vector | `[3D Vector]` | |

---

### 5. Logarithm Operation

**Function:**  
Calculates the logarithm of the argument with the specified base.

- The base should not be negative or equal to `1`.
- The argument should not be negative.
- Otherwise illegal values may be generated.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Real Number | `[float]` | |
| Input | Base | `[float]` | |
| Output | Result | `[float]` | |

---

### 6. Arccosine Function

**Function:**  
Calculates the arccosine of the input and returns the value in radians.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Input | `[float]` | |
| Output | Radian | `[float]` | |

---

### 7. Arctangent Function

**Function:**  
Calculates the arctangent of the input and returns the value in radians.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Input | `[float]` | |
| Output | Radian | `[float]` | |

---

### 8. Arcsine Function

**Function:**  
Calculates the arcsine of the input and returns the value in radians.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Input | `[float]` | |
| Output | Radian | `[float]` | |

---

### 9. Range Limiting Operation

**Function:**  
Clamps the input value to the range `[lower limit, upper limit]` (both bounds inclusive) and outputs the result.

- If the input falls within `[lower limit, upper limit]`, returns the original value.
- If the input is below the lower limit, returns the lower limit.
- If the input exceeds the upper limit, returns the upper limit.
- If the lower limit is greater than the upper limit, treats the input as invalid and returns an illegal value.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Input | `[generic]` | |
| Input | Lower Limit | `[generic]` | |
| Input | Upper Limit | `[generic]` | |
| Output | Result | `[generic]` | |

---

### 10. Direction Vector to Rotation

**Function:**  
Converts the Forward Vector and Upward Vector to Euler Angles.

Example: For a Character, suppose it has an initial orientation in 3D space. To rotate the character to a desired orientation:

- The Forward Vector indicates the direction we want the Character's nose to face.
- The Upward Vector indicates the direction we want the Character's head to point.
- Output: A 3D Euler rotation vector representing the rotation the Character must undergo to move from its initial orientation to the specified target orientation.

**Note:** Ensure the Forward and Upward Vectors are normalized. Using non-normalized vectors can produce unintended scaling and inaccurate rotation results.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Forward Vector | `[3D Vector]` | Represents the desired Orientation of the Unit |
| Input | Upward Vector | `[3D Vector]` | Defines the Unit's Up direction (used to determine the rotation angle). Default is the positive Y-axis of the World Coordinate System |
| Output | Rotate | `[3D Vector]` | Returns Euler Angles, where each component represents:<br>X – Pitch: Rotation around the local X-axis (right). Controls looking up and down.<br>Y – Yaw: Rotation around the local Y-axis (up). Controls turning left and right.<br>Z – Roll: Rotation around the local Z-axis (forward). Controls tilting the object side to side. |

---

### 11. Calculate Timestamp From Formatted Time

**Function:**  
Converts a formatted time to a timestamp.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Year | `[int]` | |
| Input | Month | `[int]` | |
| Input | Day | `[int]` | |
| Input | Hour | `[int]` | |
| Input | Minute | `[int]` | |
| Input | Second | `[int]` | |
| Output | Timestamp | `[int]` | |

---

### 12. Calculate Formatted Time From Timestamp

**Function:**  
Converts a timestamp to formatted time.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Timestamp | `[int]` | |
| Output | Year | `[int]` | |
| Output | Month | `[int]` | |
| Output | Day | `[int]` | |
| Output | Hour | `[int]` | |
| Output | Minute | `[int]` | |
| Output | Second | `[int]` | |

---

### 13. Calculate Day of the Week From Timestamp

**Function:**  
Converts a timestamp to the day of the week.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Timestamp | `[int]` | |
| Output | Weekday | `[int]` | |

---

### 14. Radians to Degrees

**Function:**  
Converts radians to degrees.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Radian Value | `[float]` | |
| Output | Angle Value | `[float]` | |

---

### 15. Addition

**Function:**  
Adds two Floating Point Numbers or Integers.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Generic | `[generic]` | |
| Input | Generic | `[generic]` | |
| Output | Result | `[generic]` | |

---

### 16. Subtraction

**Function:**  
Subtracts two Floating Point Numbers or Integers.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Generic | `[generic]` | |
| Input | Generic | `[generic]` | |
| Output | Result | `[generic]` | |

---

### 17. Degrees to Radians

**Function:**  
Converts degrees to radians.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Angle Value | `[float]` | |
| Output | Radian Value | `[float]` | |

---

### 18. Take Larger Value

**Function:**  
Returns the larger of two inputs.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Input 1 | `[generic]` | |
| Input | Input 2 | `[generic]` | |
| Output | Larger Value | `[generic]` | |

---

### 19. Take Smaller Value

**Function:**  
Returns the smaller of two inputs.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Input 1 | `[generic]` | |
| Input | Input 2 | `[generic]` | |
| Output | Smaller Value | `[generic]` | |

---

### 20. Absolute Value Operation

**Function:**  
Returns the absolute value of the input.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Input | `[generic]` | |
| Output | Result | `[generic]` | |

---

### 21. Distance Between Two Coordinate Points

**Function:**  
Calculates the Euclidean distance between two coordinates.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Coordinate Point 1 | `[3D Vector]` | |
| Input | Coordinate Point 2 | `[3D Vector]` | |
| Output | Distance | `[float]` | |

---

### 22. Logical NOT Operation

**Function:**  
Performs a logical NOT operation on the input Boolean value and returns the result.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Input | `[bool]` | |
| Output | Result | `[bool]` | |

---

### 23. Logical OR Operation

**Function:**  
Performs a logical OR operation on the two input Boolean values and returns the result.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Input 1 | `[bool]` | |
| Input | Input 2 | `[bool]` | |
| Output | Result | `[bool]` | |

---

### 24. Logical XOR Operation

**Function:**  
Performs a logical XOR operation on the two input Boolean values and returns the result.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Input 1 | `[bool]` | |
| Input | Input 2 | `[bool]` | |
| Output | Result | `[bool]` | |

---

### 25. Logical AND Operation

**Function:**  
Performs a logical AND operation on the two input Boolean values and returns the result.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Input 1 | `[bool]` | |
| Input | Input 2 | `[bool]` | |
| Output | Result | `[bool]` | |

---

### 26. Exponentiation

**Function:**  
Raises the base to the given exponent and returns the result.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Base | `[generic]` | |
| Input | Exponent | `[generic]` | |
| Output | Result | `[generic]` | |

---

### 27. Modulo Operation

**Function:**  
Returns the result of input 1 modulo input 2, with input 1 as the dividend.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Integer | `[int]` | |
| Input | Integer | `[int]` | |
| Output | Result | `[int]` | |

---

### 28. Arithmetic Square Root Operation

**Function:**  
Returns the arithmetic square root of the input value.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Input | `[float]` | |
| Output | Result | `[float]` | |

---

### 29. Sign Operation

**Function:**  
- When the input is positive, returns `1`.
- When the input is negative, returns `-1`.
- When the input is `0`, returns `0`.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Input | `[generic]` | |
| Output | Result | `[generic]` | |

---

### 30. Round to Integer Operation

**Function:**  
Performs a rounding operation based on the rounding method and returns the rounded positive number.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Input | `[float]` | |
| Input | Rounding Mode | `[enum]` | `Round`: Rounds to the nearest integer according to standard rules.<br>`Round Up`: Returns the smallest integer greater than the input value. Example: input `1.2` → `2`; input `-2.3` → `-2`.<br>`Round Down`: Returns the largest integer smaller than the input value. Example: input `1.2` → `1`; input `-2.3` → `-3`.<br>`Truncate`: Removes the decimal part of the floating point number (rounds toward zero). Example: input `1.2` → `1`; input `-2.3` → `-2`. |
| Output | Result | `[int]` | |

---

### 31. 3D Vector Normalization

**Function:**  
Normalizes the length of a 3D Vector and outputs the result.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | 3D Vector | `[3D Vector]` | |
| Output | Result | `[3D Vector]` | |

---

### 32. 3D Vector Addition

**Function:**  
Calculates the sum of two 3D Vectors.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | 3D Vector 1 | `[3D Vector]` | |
| Input | 3D Vector 2 | `[3D Vector]` | |
| Output | Result | `[3D Vector]` | |

---

### 33. 3D Vector Angle

**Function:**  
Calculates the angle between two 3D Vectors and outputs it in radians.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | 3D Vector 1 | `[3D Vector]` | |
| Input | 3D Vector 2 | `[3D Vector]` | |
| Output | Angle (Radians) | `[float]` | |

---

### 34. 3D Vector Subtraction

**Function:**  
Calculates the difference of two 3D Vectors.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | 3D Vector 1 | `[3D Vector]` | |
| Input | 3D Vector 2 | `[3D Vector]` | |
| Output | Result | `[3D Vector]` | |

---

### 35. 3D Vector Modulo Operation

**Function:**  
Calculates the magnitude of the input 3D Vector.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | 3D Vector | `[3D Vector]` | |
| Output | Result | `[float]` | |

---

### 36. 3D Vector Dot Product

**Function:**  
Calculates the dot product of two input 3D Vectors.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | 3D Vector 1 | `[3D Vector]` | |
| Input | 3D Vector 2 | `[3D Vector]` | |
| Output | Result | `[float]` | |

---

### 37. 3D Vector Zoom

**Function:**  
Scales the input 3D Vector (scalar multiplication) and outputs the result.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | 3D Vector | `[3D Vector]` | |
| Input | Zoom Multiplier | `[float]` | |
| Output | Result | `[3D Vector]` | |

---

### 38. 3D Vector Cross Product

**Function:**  
Calculates the cross product of two 3D Vectors.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | 3D Vector 1 | `[3D Vector]` | |
| Input | 3D Vector 2 | `[3D Vector]` | |
| Output | Result | `[3D Vector]` | |

---

### 39. 3D Vector Rotation

**Function:**  
Rotates the input 3D Vector by the Euler Angles specified by the rotation and returns the result.

**Note:** The Rotated 3D Vector is the one you want to rotate. The Rotated Euler Angles define how the vector should be rotated. The resulting output vector shows the position of the original 3D Vector after applying the rotation.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Rotate | `[3D Vector]` | This 3D input vector represents a specific rotation in Euler angles, where each component represents:<br>X – Pitch: Rotation around the local X-axis (right). Controls looking up and down.<br>Y – Yaw: Rotation around the local Y-axis (up). Controls turning left and right.<br>Z – Roll: Rotation around the local Z-axis (forward). Controls tilting the object side to side. |
| Input | Rotated 3D Vector | `[3D Vector]` | |
| Output | Result | `[3D Vector]` | |

---

### 40. Greater Than

**Function:**  
Returns whether the left value is greater than the right value.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Left Value | `[generic]` | |
| Input | Right Value | `[generic]` | |
| Output | Result | `[bool]` | |

---

### 41. Greater Than or Equal To

**Function:**  
Returns whether the left value is greater than or equal to the right value.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Left Value | `[generic]` | |
| Input | Right Value | `[generic]` | |
| Output | Result | `[bool]` | |

---

### 42. Less Than

**Function:**  
Returns whether the left value is less than the right value.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Left Value | `[generic]` | |
| Input | Right Value | `[generic]` | |
| Output | Result | `[bool]` | |

---

### 43. Less Than or Equal To

**Function:**  
Returns whether the left value is less than or equal to the right value.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Left Value | `[generic]` | |
| Input | Right Value | `[generic]` | |
| Output | Result | `[bool]` | |

---

### 44. Cosine Function

**Function:**  
Calculates the cosine of the input in radians.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Radian | `[float]` | |
| Output | Result | `[float]` | |

---

### 45. Tangent Function

**Function:**  
Calculates the tangent of the input in radians.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Radian | `[float]` | |
| Output | Result | `[float]` | |

---

### 46. Sine Function

**Function:**  
Calculates the sine of the input in radians.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Radian | `[float]` | |
| Output | Result | `[float]` | |

---

### 47. Left Shift Operation

**Function:**  
Performs a logical left shift on the input by the specified bit count and outputs the result.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Value | `[int]` | |
| Input | Left Shift Count | `[int]` | |
| Output | Result | `[int]` | |

---

### 48. Right Shift Operation

**Function:**  
Performs a logical right shift on the input by the specified bit count and outputs the result.

Performs an arithmetic right shift, preserving the sign bit.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Value | `[int]` | |
| Input | Right Shift Count | `[int]` | |
| Output | Result | `[int]` | |

---

### 49. Bitwise AND

**Function:**  
Performs a bitwise AND operation on the two inputs and returns the result.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Value 1 | `[int]` | |
| Input | Value 2 | `[int]` | |
| Output | Result | `[int]` | |

---

### 50. Bitwise OR

**Function:**  
Performs a bitwise OR operation on the two inputs and returns the result.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Value 1 | `[int]` | |
| Input | Value 2 | `[int]` | |
| Output | Result | `[int]` | |

---

### 51. XOR (Exclusive OR)

**Function:**  
Performs a bitwise XOR operation on the two inputs and returns the result.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Value 1 | `[int]` | |
| Input | Value 2 | `[int]` | |
| Output | Result | `[int]` | |

---

### 52. Bitwise Complement

**Function:**  
Performs a bitwise complement operation on the input and returns the result.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Value | `[int]` | |
| Output | Result | `[int]` | |

---

### 53. Write by bit

**Function:**  
Writes the write value as a binary number to the `[start bit, end bit]` of the target value (also a binary number). The start bit is indexed from `0`, and the write length includes both the start and end bits.

- If the binary significant length of the write value (counted from the first `1` from the left) exceeds the write length, the write fails and returns the original value.
- If the write value is negative, it also fails due to exceeding the write length (the first bit of a negative number's binary representation is the sign bit `1`).

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Written value | `[int]` | |
| Input | Write value | `[int]` | |
| Input | Write starting position | `[int]` | |
| Input | Write end position | `[int]` | |
| Output | Result | `[int]` | |

---

### 54. Read by bit

**Function:**  
Reads the value from `[start bit, end bit]` of the value (in binary representation).

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Value | `[int]` | |
| Input | Read starting position | `[int]` | |
| Input | Read end position | `[int]` | |
| Output | Result | `[int]` | |

---

## III. Dictionary

### 1. Create Dictionary

**Function:**  
Creates Key-Value Pairs sequentially from the input key and value lists.

- This node builds the Dictionary using the shorter of the key and value lists; extra items are truncated.
- If duplicate keys are found in the key list, creation fails and returns an empty Dictionary.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Key List | `[generic]` | |
| Input | Value List | `[generic]` | |
| Output | Dictionary | `[generic]` | |

---

### 2. Assembly Dictionary

**Function:**  
Combines up to 50 Key-Value Pairs into one Dictionary.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Key 0~49 | `[generic]` | |
| Input | Value 0~49 | `[generic]` | |
| Output | Dictionary | `[generic]` | |

---

## IV. Structures

### 1. Split Structure

**Function:**  
Returns all parameters of the specified Structure.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Target Structure | `[struct]` | |

---

### 2. Assemble Structure

**Function:**  
Combines multiple parameters into a single Structure-type value.

| Kind | Name | Type | Description |
|---|---|---|---|
| Output | Structure | `[struct]` | |