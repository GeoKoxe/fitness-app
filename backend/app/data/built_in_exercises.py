"""Curated built-in exercise catalogue covering standard multi-joint compounds and isolations.

Movement categories:
- horizontal_push, vertical_push, horizontal_pull, vertical_pull
- squat, hinge, lunge, isolation, core, carry

Primary muscle groups:
- chest, lats, upper_back, shoulders, biceps, triceps
- quadriceps, hamstrings, glutes, calves, abdominals, lower_back

Equipment types:
- barbell, dumbbell, bodyweight, cable, machine, bench, pullup_bar, resistance_band
"""

from typing import Any, Dict, List

BUILT_IN_EXERCISES: List[Dict[str, Any]] = [
    # =========================================================================
    # CHEST / HORIZONTAL PUSH (7)
    # =========================================================================
    {
        "slug": "barbell_bench_press",
        "name": "Barbell Bench Press",
        "movement_category": "horizontal_push",
        "primary_muscle": "chest",
        "secondary_muscles": "triceps,shoulders",
        "equipment_required": "barbell",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Lie back on a flat bench with your eyes directly under the racked barbell.\n"
            "2. Plant your feet firmly on the floor and grip the bar slightly wider than shoulder-width with wrapped thumbs.\n"
            "3. Retract your shoulder blades and unrack the bar over your mid-chest with straight arms.\n"
            "4. Inhale, brace your core, and lower the bar under control to touch your mid-sternum, keeping elbows tucked at ~45-75 degrees.\n"
            "5. Press the bar up and slightly back toward your eye-line until elbows are fully extended without shrugging."
        ),
        "alternative_exercise_slugs": "dumbbell_bench_press,push_up,machine_chest_press",
    },
    {
        "slug": "dumbbell_bench_press",
        "name": "Dumbbell Flat Bench Press",
        "movement_category": "horizontal_push",
        "primary_muscle": "chest",
        "secondary_muscles": "triceps,shoulders",
        "equipment_required": "dumbbell",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Sit on a flat bench with dumbbells resting on your thighs.\n"
            "2. Kick the weights up with your knees as you lie back, holding dumbbells at chest level with palms facing forward.\n"
            "3. Retract shoulder blades, keep feet flat, and press dumbbells upward until arms are extended without clanking them together.\n"
            "4. Lower weights with control until upper arms are parallel to the floor or slightly below, feeling a deep stretch across the chest."
        ),
        "alternative_exercise_slugs": "barbell_bench_press,push_up,incline_dumbbell_press",
    },
    {
        "slug": "incline_dumbbell_press",
        "name": "Incline Dumbbell Press",
        "movement_category": "horizontal_push",
        "primary_muscle": "chest",
        "secondary_muscles": "shoulders,triceps",
        "equipment_required": "dumbbell",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Set an adjustable bench to an incline angle between 30 and 45 degrees.\n"
            "2. Sit down, kick dumbbells to your shoulders, and pin shoulder blades back into the pad.\n"
            "3. Press weights smoothly toward the ceiling until arms are extended.\n"
            "4. Lower weights under control to the upper chest level, maintaining neutral wrists."
        ),
        "alternative_exercise_slugs": "dumbbell_bench_press,machine_chest_press",
    },
    {
        "slug": "push_up",
        "name": "Standard Push-Up",
        "movement_category": "horizontal_push",
        "primary_muscle": "chest",
        "secondary_muscles": "triceps,shoulders,abdominals",
        "equipment_required": "bodyweight",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Assume a high plank position with hands positioned slightly wider than shoulder-width.\n"
            "2. Keep your body in a rigid straight line from head to heels by squeezing glutes and engaging your core.\n"
            "3. Lower your chest until it hovers an inch above the floor, keeping elbows tracking at roughly 45 degrees.\n"
            "4. Press forcefully through palms back to full lockout without sagging hips."
        ),
        "alternative_exercise_slugs": "dumbbell_bench_press,chest_dips",
    },
    {
        "slug": "chest_dips",
        "name": "Chest Dips",
        "movement_category": "horizontal_push",
        "primary_muscle": "chest",
        "secondary_muscles": "triceps,shoulders",
        "equipment_required": "bodyweight",
        "difficulty_level": "advanced",
        "instructions": (
            "1. Grip parallel bars firmly and press up to support your full bodyweight with straight arms.\n"
            "2. Lean your torso forward roughly 20-30 degrees and bend knees slightly.\n"
            "3. Bend elbows and lower yourself smoothly until shoulders are slightly below elbows or a comfortable stretch is felt.\n"
            "4. Drive through the heels of your hands back up to full extension while maintaining the forward torso lean."
        ),
        "alternative_exercise_slugs": "push_up,dumbbell_bench_press,cable_chest_fly",
    },
    {
        "slug": "cable_chest_fly",
        "name": "Cable Chest Fly",
        "movement_category": "isolation",
        "primary_muscle": "chest",
        "secondary_muscles": "shoulders",
        "equipment_required": "cable",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Set dual cable pulleys to chest or shoulder height with single D-handles attached.\n"
            "2. Step forward into a staggered stance with a slight forward torso lean.\n"
            "3. Maintain a slight, soft bend in elbows as you sweep your hands forward and together in a wide hugging arc.\n"
            "4. Squeeze chest at peak contraction, then slowly reverse the motion back to a gentle stretch."
        ),
        "alternative_exercise_slugs": "dumbbell_chest_fly,push_up",
    },
    {
        "slug": "machine_chest_press",
        "name": "Machine Chest Press",
        "movement_category": "horizontal_push",
        "primary_muscle": "chest",
        "secondary_muscles": "triceps,shoulders",
        "equipment_required": "machine",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Adjust seat height so handles align with mid-chest.\n"
            "2. Sit back against pad, plant feet, and grip handles evenly.\n"
            "3. Press handles forward smoothly until arms are extended without locking joints abruptly.\n"
            "4. Lower the weight under control until handles return near chest level."
        ),
        "alternative_exercise_slugs": "barbell_bench_press,dumbbell_bench_press",
    },

    # =========================================================================
    # SHOULDERS / VERTICAL PUSH & ISOLATIONS (7)
    # =========================================================================
    {
        "slug": "overhead_barbell_press",
        "name": "Overhead Barbell Press",
        "movement_category": "vertical_push",
        "primary_muscle": "shoulders",
        "secondary_muscles": "triceps,upper_back,abdominals",
        "equipment_required": "barbell",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Stand with feet shoulder-width apart, holding the barbell across your front deltoids with hands just outside shoulders.\n"
            "2. Squeeze glutes, brace abs, and tilt head slightly back as you drive the barbell vertically in a straight path.\n"
            "3. Once the bar passes forehead level, press your head forward into natural alignment and lock out overhead.\n"
            "4. Lower the bar under control back to the collarbone shelf."
        ),
        "alternative_exercise_slugs": "seated_dumbbell_shoulder_press,machine_shoulder_press",
    },
    {
        "slug": "seated_dumbbell_shoulder_press",
        "name": "Seated Dumbbell Shoulder Press",
        "movement_category": "vertical_push",
        "primary_muscle": "shoulders",
        "secondary_muscles": "triceps,upper_back",
        "equipment_required": "dumbbell",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Sit upright on an adjustable bench set at a high incline (approx. 75-85 degrees).\n"
            "2. Hold dumbbells at shoulder height with palms facing forward or slightly angled in.\n"
            "3. Press weights upward in an arc overhead until arms are extended.\n"
            "4. Lower weights smoothly until dumbbells are level with ears."
        ),
        "alternative_exercise_slugs": "overhead_barbell_press,machine_shoulder_press",
    },
    {
        "slug": "dumbbell_lateral_raise",
        "name": "Dumbbell Lateral Raise",
        "movement_category": "isolation",
        "primary_muscle": "shoulders",
        "secondary_muscles": "upper_back",
        "equipment_required": "dumbbell",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Stand tall holding light dumbbells at your sides with neutral grip.\n"
            "2. Maintain a slight forward torso lean and soft bend in elbows.\n"
            "3. Raise arms out to the sides in the scapular plane until hands reach shoulder height.\n"
            "4. Pause briefly at parallel and lower weights slowly without swinging."
        ),
        "alternative_exercise_slugs": "cable_lateral_raise",
    },
    {
        "slug": "cable_lateral_raise",
        "name": "Cable Lateral Raise",
        "movement_category": "isolation",
        "primary_muscle": "shoulders",
        "secondary_muscles": "upper_back",
        "equipment_required": "cable",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Set a single cable pulley at low ankle or knee height.\n"
            "2. Stand sideways to pulley, holding handle with far arm across your body.\n"
            "3. Sweep arm outward and upward until hand is level with shoulder.\n"
            "4. Control the eccentric descent against constant cable tension."
        ),
        "alternative_exercise_slugs": "dumbbell_lateral_raise",
    },
    {
        "slug": "face_pull",
        "name": "Cable Face Pull",
        "movement_category": "horizontal_pull",
        "primary_muscle": "shoulders",
        "secondary_muscles": "upper_back",
        "equipment_required": "cable",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Attach a rope to a cable pulley at upper-chest or eye level.\n"
            "2. Grip rope with thumbs pointing back, step back into a stable stance.\n"
            "3. Pull rope toward your nose and forehead while externally rotating shoulders, pulling rope ends apart.\n"
            "4. Squeeze rear deltoids and upper back for a full second, then return smoothly."
        ),
        "alternative_exercise_slugs": "dumbbell_rear_delt_fly",
    },
    {
        "slug": "dumbbell_rear_delt_fly",
        "name": "Bent-Over Dumbbell Rear Delt Fly",
        "movement_category": "isolation",
        "primary_muscle": "shoulders",
        "secondary_muscles": "upper_back",
        "equipment_required": "dumbbell",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Hinge at hips with a flat back until torso is nearly parallel to floor.\n"
            "2. Hold light dumbbells hanging down with palms facing each other.\n"
            "3. With soft elbows, raise dumbbells outward to shoulder height, focusing on rear delts.\n"
            "4. Lower weights with control without using momentum."
        ),
        "alternative_exercise_slugs": "face_pull",
    },
    {
        "slug": "machine_shoulder_press",
        "name": "Machine Shoulder Press",
        "movement_category": "vertical_push",
        "primary_muscle": "shoulders",
        "secondary_muscles": "triceps",
        "equipment_required": "machine",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Adjust seat so handles begin at or slightly above ear height.\n"
            "2. Press upward along fixed track to full overhead extension.\n"
            "3. Lower slowly until handles return to starting depth."
        ),
        "alternative_exercise_slugs": "seated_dumbbell_shoulder_press,overhead_barbell_press",
    },

    # =========================================================================
    # BACK / VERTICAL PULL (4)
    # =========================================================================
    {
        "slug": "pull_up",
        "name": "Pull-Up",
        "movement_category": "vertical_pull",
        "primary_muscle": "lats",
        "secondary_muscles": "biceps,upper_back",
        "equipment_required": "pullup_bar",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Hang from a pull-up bar with an overhand (pronated) grip slightly wider than shoulder-width.\n"
            "2. Depress your shoulder blades down and pull your elbows down toward your ribs.\n"
            "3. Pull until your chin clears the bar, maintaining tight core and legs.\n"
            "4. Lower yourself under complete control back to full dead hang."
        ),
        "alternative_exercise_slugs": "lat_pulldown,chin_up",
    },
    {
        "slug": "chin_up",
        "name": "Chin-Up",
        "movement_category": "vertical_pull",
        "primary_muscle": "lats",
        "secondary_muscles": "biceps,upper_back",
        "equipment_required": "pullup_bar",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Grip pull-up bar with an underhand (supinated) grip at shoulder width.\n"
            "2. Pull chest toward bar, emphasizing bicep and lat contraction.\n"
            "3. Bring chin clearly over the bar, then lower under control to full extension."
        ),
        "alternative_exercise_slugs": "pull_up,lat_pulldown",
    },
    {
        "slug": "lat_pulldown",
        "name": "Cable Lat Pulldown",
        "movement_category": "vertical_pull",
        "primary_muscle": "lats",
        "secondary_muscles": "biceps,upper_back",
        "equipment_required": "cable",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Sit at lat pulldown machine and secure thigh pads snugly above knees.\n"
            "2. Grip wide bar with overhand grip and lean back slightly (10-15 degrees).\n"
            "3. Pull bar smoothly down to touch upper chest while driving elbows toward your hips.\n"
            "4. Slowly allow bar to rise back to full overhead stretch."
        ),
        "alternative_exercise_slugs": "pull_up,chin_up",
    },
    {
        "slug": "neutral_grip_lat_pulldown",
        "name": "Close-Grip Lat Pulldown",
        "movement_category": "vertical_pull",
        "primary_muscle": "lats",
        "secondary_muscles": "biceps,upper_back",
        "equipment_required": "cable",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Attach a V-bar or neutral double-D handle to the overhead pulldown cable.\n"
            "2. Pull handle down to collarbone level, squeezing lats and mid-back.\n"
            "3. Extend arms back up under control feeling a deep stretch along lats."
        ),
        "alternative_exercise_slugs": "lat_pulldown,pull_up",
    },

    # =========================================================================
    # BACK / HORIZONTAL PULL (5)
    # =========================================================================
    {
        "slug": "barbell_bent_over_row",
        "name": "Barbell Bent-Over Row",
        "movement_category": "horizontal_pull",
        "primary_muscle": "upper_back",
        "secondary_muscles": "lats,biceps,lower_back",
        "equipment_required": "barbell",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Stand with feet hip-width apart and grip barbell with overhand grip just outside knees.\n"
            "2. Hinge forward at hips with flat spine until torso is roughly 45 degrees to floor.\n"
            "3. Pull bar toward lower ribs/navel, retracting shoulder blades at peak.\n"
            "4. Lower bar under control until arms hang fully extended."
        ),
        "alternative_exercise_slugs": "one_arm_dumbbell_row,seated_cable_row",
    },
    {
        "slug": "one_arm_dumbbell_row",
        "name": "One-Arm Dumbbell Row",
        "movement_category": "horizontal_pull",
        "primary_muscle": "lats",
        "secondary_muscles": "upper_back,biceps",
        "equipment_required": "dumbbell",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Place one knee and same-side hand on a flat bench to support your spine.\n"
            "2. Grip dumbbell with free hand and let it hang perpendicular to the floor.\n"
            "3. Pull dumbbell back toward hip crease, leading with elbow.\n"
            "4. Lower weight smoothly to full lat stretch."
        ),
        "alternative_exercise_slugs": "barbell_bent_over_row,seated_cable_row",
    },
    {
        "slug": "seated_cable_row",
        "name": "Seated Cable Row",
        "movement_category": "horizontal_pull",
        "primary_muscle": "upper_back",
        "secondary_muscles": "lats,biceps",
        "equipment_required": "cable",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Sit at low pulley cable station with feet braced and knees slightly bent.\n"
            "2. Keep torso upright and pull handle toward lower abdomen.\n"
            "3. Squeeze shoulder blades together firmly, avoiding excessive swinging or leaning back.\n"
            "4. Return handle forward under control with extended arms."
        ),
        "alternative_exercise_slugs": "one_arm_dumbbell_row,barbell_bent_over_row",
    },
    {
        "slug": "chest_supported_tbar_row",
        "name": "Chest-Supported Machine Row",
        "movement_category": "horizontal_pull",
        "primary_muscle": "upper_back",
        "secondary_muscles": "lats,biceps",
        "equipment_required": "machine",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Rest chest against incline support pad, eliminating lower back strain.\n"
            "2. Grip handles firmly and pull elbows back past torso plane.\n"
            "3. Squeeze upper back muscles for one second before lowering weight."
        ),
        "alternative_exercise_slugs": "seated_cable_row,one_arm_dumbbell_row",
    },
    {
        "slug": "inverted_row",
        "name": "Inverted Bodyweight Row",
        "movement_category": "horizontal_pull",
        "primary_muscle": "upper_back",
        "secondary_muscles": "biceps,lats,core",
        "equipment_required": "bodyweight",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Position a barbell inside a squat rack at roughly waist height.\n"
            "2. Lie beneath bar and grab it with an overhand grip wider than shoulders.\n"
            "3. Keep body in a rigid straight plank on your heels.\n"
            "4. Pull chest up to touch the bar, pause, and lower under control."
        ),
        "alternative_exercise_slugs": "seated_cable_row,pull_up",
    },

    # =========================================================================
    # QUADRICEPS / SQUAT PATTERN (8)
    # =========================================================================
    {
        "slug": "barbell_back_squat",
        "name": "Barbell Back Squat",
        "movement_category": "squat",
        "primary_muscle": "quadriceps",
        "secondary_muscles": "glutes,hamstrings,lower_back",
        "equipment_required": "barbell",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Step under bar in squat rack, resting it across upper trapezius muscles.\n"
            "2. Unrack with feet shoulder-width apart, toes flared slightly out.\n"
            "3. Take a deep diaphragmatic breath, brace core, and bend hips and knees simultaneously.\n"
            "4. Descend until hip crease is below the top of knees, maintaining knees in line with toes.\n"
            "5. Drive up through mid-foot back to standing lockout."
        ),
        "alternative_exercise_slugs": "leg_press,goblet_squat,barbell_front_squat",
    },
    {
        "slug": "barbell_front_squat",
        "name": "Barbell Front Squat",
        "movement_category": "squat",
        "primary_muscle": "quadriceps",
        "secondary_muscles": "glutes,abdominals,upper_back",
        "equipment_required": "barbell",
        "difficulty_level": "advanced",
        "instructions": (
            "1. Rest bar across front deltoid shelf, holding with clean fingertip grip or cross-arm grip.\n"
            "2. Keep elbows driven high parallel to floor throughout the lift.\n"
            "3. Squat down with upright torso depth, maintaining tall chest.\n"
            "4. Drive out of the bottom position keeping elbows elevated."
        ),
        "alternative_exercise_slugs": "barbell_back_squat,goblet_squat",
    },
    {
        "slug": "goblet_squat",
        "name": "Dumbbell Goblet Squat",
        "movement_category": "squat",
        "primary_muscle": "quadriceps",
        "secondary_muscles": "glutes,abdominals",
        "equipment_required": "dumbbell",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Stand tall holding one dumbbell vertically against chest with both hands under top bell.\n"
            "2. Set stance slightly wider than shoulder width with toes turned out.\n"
            "3. Squat down between knees, keeping torso upright and chest tall.\n"
            "4. Stand back up by pushing through the ground."
        ),
        "alternative_exercise_slugs": "bodyweight_air_squat,leg_press",
    },
    {
        "slug": "leg_press",
        "name": "Machine 45-Degree Leg Press",
        "movement_category": "squat",
        "primary_muscle": "quadriceps",
        "secondary_muscles": "glutes,hamstrings",
        "equipment_required": "machine",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Sit securely in leg press sled with back flat against backrest.\n"
            "2. Place feet shoulder-width in center of platform.\n"
            "3. Release safety catches and bend knees smoothly to 90 degrees or as deep as pelvis stays flat.\n"
            "4. Press platform away through mid-foot, avoiding forceful joint hyper-extension."
        ),
        "alternative_exercise_slugs": "barbell_back_squat,goblet_squat",
    },
    {
        "slug": "leg_extension",
        "name": "Machine Leg Extension",
        "movement_category": "isolation",
        "primary_muscle": "quadriceps",
        "secondary_muscles": "",
        "equipment_required": "machine",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Sit on machine with knees aligned with machine pivot point and pad resting on lower shins.\n"
            "2. Extend knees smoothly until legs are straight.\n"
            "3. Squeeze quadriceps at top for a second, then lower slowly through full range."
        ),
        "alternative_exercise_slugs": "goblet_squat",
    },
    {
        "slug": "bulgarian_split_squat",
        "name": "Bulgarian Split Squat",
        "movement_category": "lunge",
        "primary_muscle": "quadriceps",
        "secondary_muscles": "glutes,hamstrings",
        "equipment_required": "dumbbell",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Stand roughly 2 feet in front of a flat bench, placing top of rear foot on the bench.\n"
            "2. Hold dumbbells at sides and keep chest proud.\n"
            "3. Lower rear knee toward floor until front thigh is parallel with floor.\n"
            "4. Drive through front heel back to top position."
        ),
        "alternative_exercise_slugs": "walking_lunges,goblet_squat",
    },
    {
        "slug": "walking_lunges",
        "name": "Dumbbell Walking Lunges",
        "movement_category": "lunge",
        "primary_muscle": "quadriceps",
        "secondary_muscles": "glutes,hamstrings,calves",
        "equipment_required": "dumbbell",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Stand tall holding dumbbells at sides.\n"
            "2. Take a controlled forward step and lower rear knee until gently hovering above ground.\n"
            "3. Push off front foot to step directly into the next forward lunge."
        ),
        "alternative_exercise_slugs": "bulgarian_split_squat,goblet_squat",
    },
    {
        "slug": "bodyweight_air_squat",
        "name": "Bodyweight Air Squat",
        "movement_category": "squat",
        "primary_muscle": "quadriceps",
        "secondary_muscles": "glutes,hamstrings",
        "equipment_required": "bodyweight",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Stand with feet shoulder-width apart and arms out front for balance.\n"
            "2. Squat down hips-first until thighs break parallel.\n"
            "3. Push through whole foot to stand back tall."
        ),
        "alternative_exercise_slugs": "goblet_squat",
    },

    # =========================================================================
    # HAMSTRINGS & GLUTES / HINGE PATTERN (8)
    # =========================================================================
    {
        "slug": "barbell_deadlift",
        "name": "Conventional Barbell Deadlift",
        "movement_category": "hinge",
        "primary_muscle": "hamstrings",
        "secondary_muscles": "glutes,lower_back,upper_back,quadriceps",
        "equipment_required": "barbell",
        "difficulty_level": "advanced",
        "instructions": (
            "1. Stand with feet hip-width apart, barbell cutting across mid-foot.\n"
            "2. Hinge forward and grip bar just outside shins with straight arms.\n"
            "3. Pull chest up, flatten back, and take slack out of the bar.\n"
            "4. Drive feet through the floor, standing up tall with glutes locked."
        ),
        "alternative_exercise_slugs": "romanian_deadlift,barbell_hip_thrust",
    },
    {
        "slug": "romanian_deadlift",
        "name": "Barbell Romanian Deadlift (RDL)",
        "movement_category": "hinge",
        "primary_muscle": "hamstrings",
        "secondary_muscles": "glutes,lower_back",
        "equipment_required": "barbell",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Stand upright holding barbell at hip level with shoulder-width grip.\n"
            "2. Maintain soft knee bend and push hips backward as bar slides down thighs.\n"
            "3. Lower bar until hamstrings reach full stretch around mid-shin level with flat spine.\n"
            "4. Push hips forward to return to standing lockout."
        ),
        "alternative_exercise_slugs": "dumbbell_romanian_deadlift,lying_leg_curl",
    },
    {
        "slug": "dumbbell_romanian_deadlift",
        "name": "Dumbbell Romanian Deadlift",
        "movement_category": "hinge",
        "primary_muscle": "hamstrings",
        "secondary_muscles": "glutes,lower_back",
        "equipment_required": "dumbbell",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Hold dumbbells in front of thighs with feet hip-width apart.\n"
            "2. Hinge at hips with soft knees, lowering weights along shin path.\n"
            "3. Squeeze glutes and hamstrings to return to starting stance."
        ),
        "alternative_exercise_slugs": "romanian_deadlift,lying_leg_curl",
    },
    {
        "slug": "lying_leg_curl",
        "name": "Lying Machine Leg Curl",
        "movement_category": "isolation",
        "primary_muscle": "hamstrings",
        "secondary_muscles": "calves",
        "equipment_required": "machine",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Lie face down on machine with roller pad positioned above heels.\n"
            "2. Keep hips anchored to bench as you curl heels toward glutes.\n"
            "3. Squeeze hamstrings at peak contraction and lower weight with control."
        ),
        "alternative_exercise_slugs": "seated_leg_curl,dumbbell_romanian_deadlift",
    },
    {
        "slug": "seated_leg_curl",
        "name": "Seated Machine Leg Curl",
        "movement_category": "isolation",
        "primary_muscle": "hamstrings",
        "secondary_muscles": "calves",
        "equipment_required": "machine",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Sit on machine with back pad adjusted so knee joint aligns with machine axis.\n"
            "2. Secure thigh pad tightly over quads.\n"
            "3. Curl heels downward and backward underneath seat.\n"
            "4. Slowly resist the weight as knees extend back to start."
        ),
        "alternative_exercise_slugs": "lying_leg_curl,romanian_deadlift",
    },
    {
        "slug": "barbell_hip_thrust",
        "name": "Barbell Hip Thrust",
        "movement_category": "hinge",
        "primary_muscle": "glutes",
        "secondary_muscles": "hamstrings",
        "equipment_required": "barbell",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Sit on floor with upper back against bench and padded barbell over hips.\n"
            "2. Set feet flat shoulder-width apart so shins are vertical at top of lift.\n"
            "3. Drive through heels and extend hips upward until torso and thighs form a straight bridge.\n"
            "4. Squeeze glutes hard at top, keeping ribs down, then lower smoothly."
        ),
        "alternative_exercise_slugs": "dumbbell_glute_bridge,romanian_deadlift",
    },
    {
        "slug": "dumbbell_glute_bridge",
        "name": "Dumbbell Glute Bridge",
        "movement_category": "hinge",
        "primary_muscle": "glutes",
        "secondary_muscles": "hamstrings",
        "equipment_required": "dumbbell",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Lie flat on back with knees bent and feet flat on floor.\n"
            "2. Rest a dumbbell across your pelvis, holding it securely with both hands.\n"
            "3. Drive hips up toward ceiling by squeezing glutes, pause, and lower."
        ),
        "alternative_exercise_slugs": "barbell_hip_thrust",
    },
    {
        "slug": "kettlebell_swing",
        "name": "Kettlebell / Dumbbell Swing",
        "movement_category": "hinge",
        "primary_muscle": "glutes",
        "secondary_muscles": "hamstrings,lower_back,shoulders",
        "equipment_required": "dumbbell",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Stand with feet slightly wider than shoulders holding weight with both hands.\n"
            "2. Hinge hips back, letting weight swing between legs.\n"
            "3. Snap hips explosively forward to drive weight up to chest level.\n"
            "4. Control the downward hinge under core control."
        ),
        "alternative_exercise_slugs": "romanian_deadlift",
    },

    # =========================================================================
    # ARMS / BICEPS (4)
    # =========================================================================
    {
        "slug": "barbell_biceps_curl",
        "name": "Barbell Biceps Curl",
        "movement_category": "isolation",
        "primary_muscle": "biceps",
        "secondary_muscles": "forearms",
        "equipment_required": "barbell",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Stand tall holding a barbell with underhand shoulder-width grip.\n"
            "2. Keep elbows pinned close to sides of your torso.\n"
            "3. Curl the barbell upward by contracting biceps until elbows reach full flexion.\n"
            "4. Lower under control back to full extension."
        ),
        "alternative_exercise_slugs": "dumbbell_hammer_curl,cable_biceps_curl",
    },
    {
        "slug": "dumbbell_hammer_curl",
        "name": "Dumbbell Hammer Curl",
        "movement_category": "isolation",
        "primary_muscle": "biceps",
        "secondary_muscles": "forearms",
        "equipment_required": "dumbbell",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Hold dumbbells at sides with palms facing inward toward each other (neutral grip).\n"
            "2. Curl weights up without rotating wrists, targeting brachialis and forearms.\n"
            "3. Lower smoothly through eccentric phase."
        ),
        "alternative_exercise_slugs": "barbell_biceps_curl,cable_biceps_curl",
    },
    {
        "slug": "incline_dumbbell_curl",
        "name": "Incline Dumbbell Biceps Curl",
        "movement_category": "isolation",
        "primary_muscle": "biceps",
        "secondary_muscles": "forearms",
        "equipment_required": "dumbbell",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Lie back on an incline bench set to ~45-60 degrees.\n"
            "2. Let arms hang straight down behind torso line to place biceps in full stretch.\n"
            "3. Curl dumbbells upward while supinating wrists, squeeze, and lower."
        ),
        "alternative_exercise_slugs": "barbell_biceps_curl,cable_biceps_curl",
    },
    {
        "slug": "cable_biceps_curl",
        "name": "Cable Biceps Curl",
        "movement_category": "isolation",
        "primary_muscle": "biceps",
        "secondary_muscles": "forearms",
        "equipment_required": "cable",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Attach a straight or EZ-curl bar to low pulley cable.\n"
            "2. Curl bar toward shoulders with constant cable resistance throughout arc.\n"
            "3. Lower smoothly resisting the weight stack."
        ),
        "alternative_exercise_slugs": "barbell_biceps_curl,dumbbell_hammer_curl",
    },

    # =========================================================================
    # ARMS / TRICEPS (4)
    # =========================================================================
    {
        "slug": "triceps_rope_pushdown",
        "name": "Cable Triceps Rope Pushdown",
        "movement_category": "isolation",
        "primary_muscle": "triceps",
        "secondary_muscles": "",
        "equipment_required": "cable",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Attach rope to high cable pulley and grip rope with neutral hands.\n"
            "2. Tuck elbows at sides and press downward until arms are straight.\n"
            "3. Spread rope ends apart at bottom for maximum tricep contraction.\n"
            "4. Allow hands to rise back to elbow height under control."
        ),
        "alternative_exercise_slugs": "skull_crusher,overhead_triceps_extension",
    },
    {
        "slug": "skull_crusher",
        "name": "Lying Barbell Triceps Extension (Skull Crusher)",
        "movement_category": "isolation",
        "primary_muscle": "triceps",
        "secondary_muscles": "",
        "equipment_required": "barbell",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Lie flat on a bench holding an EZ or straight barbell over chest.\n"
            "2. Keep upper arms angled slightly back from vertical.\n"
            "3. Bend elbows to lower bar smoothly toward top of forehead.\n"
            "4. Extend elbows to press bar back to starting position."
        ),
        "alternative_exercise_slugs": "triceps_rope_pushdown,overhead_triceps_extension",
    },
    {
        "slug": "overhead_triceps_extension",
        "name": "Overhead Dumbbell Triceps Extension",
        "movement_category": "isolation",
        "primary_muscle": "triceps",
        "secondary_muscles": "",
        "equipment_required": "dumbbell",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Sit or stand holding one dumbbell overhead with both hands cup-gripping upper weight.\n"
            "2. Lower weight behind head by bending elbows while keeping upper arms close to ears.\n"
            "3. Press dumbbell back to overhead extension."
        ),
        "alternative_exercise_slugs": "triceps_rope_pushdown,skull_crusher",
    },
    {
        "slug": "close_grip_bench_press",
        "name": "Close-Grip Barbell Bench Press",
        "movement_category": "horizontal_push",
        "primary_muscle": "triceps",
        "secondary_muscles": "chest,shoulders",
        "equipment_required": "barbell",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Lie on bench and grip bar with hands set at shoulder width (not too narrow to protect wrists).\n"
            "2. Lower bar to lower chest while keeping elbows tucked tightly.\n"
            "3. Press up forcefully through triceps to lockout."
        ),
        "alternative_exercise_slugs": "skull_crusher,triceps_rope_pushdown",
    },

    # =========================================================================
    # CALVES (2)
    # =========================================================================
    {
        "slug": "standing_calf_raise",
        "name": "Standing Calf Raise",
        "movement_category": "isolation",
        "primary_muscle": "calves",
        "secondary_muscles": "",
        "equipment_required": "machine",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Position balls of feet on step edge and rest shoulder pads on shoulders.\n"
            "2. Lower heels down into a deep calf stretch.\n"
            "3. Rise onto toes as high as possible, pause for 1 second, and lower slowly."
        ),
        "alternative_exercise_slugs": "seated_calf_raise",
    },
    {
        "slug": "seated_calf_raise",
        "name": "Seated Machine Calf Raise",
        "movement_category": "isolation",
        "primary_muscle": "calves",
        "secondary_muscles": "",
        "equipment_required": "machine",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Sit at machine with knees under thigh pads and balls of feet on platform.\n"
            "2. Drop heels for full stretch, then press through toes to peak soleus contraction.\n"
            "3. Lower under control."
        ),
        "alternative_exercise_slugs": "standing_calf_raise",
    },

    # =========================================================================
    # CORE / ABDOMINALS (6)
    # =========================================================================
    {
        "slug": "hanging_leg_raise",
        "name": "Hanging Leg Raise",
        "movement_category": "core",
        "primary_muscle": "abdominals",
        "secondary_muscles": "forearms",
        "equipment_required": "pullup_bar",
        "difficulty_level": "advanced",
        "instructions": (
            "1. Hang from a pull-up bar with straight arms and tight core.\n"
            "2. Raise legs up with knees straight or slightly bent until thighs are parallel to floor or higher.\n"
            "3. Control the descent without swinging body."
        ),
        "alternative_exercise_slugs": "decline_crunch,plank",
    },
    {
        "slug": "plank",
        "name": "Forearm Plank",
        "movement_category": "core",
        "primary_muscle": "abdominals",
        "secondary_muscles": "shoulders,glutes",
        "equipment_required": "bodyweight",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Support yourself on forearms and toes with elbows directly below shoulders.\n"
            "2. Squeeze glutes and abs to keep body in a rigid straight line.\n"
            "3. Hold position statically without letting lower back sag."
        ),
        "alternative_exercise_slugs": "hanging_leg_raise,ab_wheel_rollout",
    },
    {
        "slug": "ab_wheel_rollout",
        "name": "Ab Wheel Rollout",
        "movement_category": "core",
        "primary_muscle": "abdominals",
        "secondary_muscles": "lats,shoulders",
        "equipment_required": "bodyweight",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Kneel on a soft mat holding ab wheel handles below shoulders.\n"
            "2. Roll wheel forward smoothly, extending torso as far as you can control with flat back.\n"
            "3. Pull wheel back toward knees by contracting abdominals."
        ),
        "alternative_exercise_slugs": "plank,hanging_leg_raise",
    },
    {
        "slug": "decline_crunch",
        "name": "Decline Bench Crunch",
        "movement_category": "core",
        "primary_muscle": "abdominals",
        "secondary_muscles": "",
        "equipment_required": "bench",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Hook feet into decline bench leg supports and lie back.\n"
            "2. Cross arms over chest or fingertips by temples.\n"
            "3. Curl torso upward by flexing abs, pause, and lower under control."
        ),
        "alternative_exercise_slugs": "hanging_leg_raise,plank",
    },
    {
        "slug": "cable_woodchopper",
        "name": "Cable Standing Woodchopper",
        "movement_category": "core",
        "primary_muscle": "abdominals",
        "secondary_muscles": "shoulders",
        "equipment_required": "cable",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Set cable pulley high with a single handle.\n"
            "2. Stand sideways, grip handle with both hands, and rotate torso diagonally downward across body.\n"
            "3. Pivot back foot, squeeze obliques, and return with control."
        ),
        "alternative_exercise_slugs": "plank,decline_crunch",
    },
    {
        "slug": "farmer_walk",
        "name": "Dumbbell Farmer's Walk",
        "movement_category": "carry",
        "primary_muscle": "abdominals",
        "secondary_muscles": "forearms,upper_back,calves",
        "equipment_required": "dumbbell",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Deadlift a pair of heavy dumbbells off the floor.\n"
            "2. Stand tall with pulled-back shoulders and braced core.\n"
            "3. Walk forward in short, controlled, deliberate steps without swaying sideways.\n"
            "4. Carefully lower dumbbells back down at completion."
        ),
        "alternative_exercise_slugs": "plank",
    },
    {
        "slug": "pike_push_up",
        "name": "Pike Push-Up",
        "movement_category": "vertical_push",
        "primary_muscle": "shoulders",
        "secondary_muscles": "triceps,upper_back",
        "equipment_required": "bodyweight",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Start in a standard push-up position and walk feet forward while lifting hips into an inverted V-shape.\n"
            "2. Keep legs straight and look toward your feet with shoulders loaded.\n"
            "3. Lower the crown of your head smoothly toward the floor ahead of your fingertips.\n"
            "4. Press forcefully through your palms back to the top pike position."
        ),
        "alternative_exercise_slugs": "push_up,bench_dips_bodyweight",
    },
    {
        "slug": "bench_dips_bodyweight",
        "name": "Bodyweight Bench Dips",
        "movement_category": "vertical_push",
        "primary_muscle": "triceps",
        "secondary_muscles": "shoulders,chest",
        "equipment_required": "bodyweight",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Position hands shoulder-width apart behind you on a sturdy bench or chair edge.\n"
            "2. Extend legs forward with knees slightly bent and torso upright.\n"
            "3. Lower hips toward the floor by bending elbows until upper arms are parallel to the floor.\n"
            "4. Drive through the palms to extend arms fully back to starting position."
        ),
        "alternative_exercise_slugs": "chest_dips,diamond_push_up",
    },
    {
        "slug": "diamond_push_up",
        "name": "Diamond Push-Up",
        "movement_category": "horizontal_push",
        "primary_muscle": "triceps",
        "secondary_muscles": "chest,shoulders",
        "equipment_required": "bodyweight",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Assume a plank position with hands positioned under chest, thumbs and index fingers touching in a diamond.\n"
            "2. Keep elbows tucked closely along your ribcage as you lower chest to touch hands.\n"
            "3. Drive palms hard through the floor to full triceps lockout."
        ),
        "alternative_exercise_slugs": "push_up,bench_dips_bodyweight",
    },
    {
        "slug": "bodyweight_glute_bridge",
        "name": "Bodyweight Glute Bridge",
        "movement_category": "hinge",
        "primary_muscle": "glutes",
        "secondary_muscles": "hamstrings,lower_back",
        "equipment_required": "bodyweight",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Lie on your back with knees bent and feet flat on the floor hip-width apart.\n"
            "2. Drive through heels to extend hips toward the ceiling until knees, hips, and shoulders form a straight line.\n"
            "3. Squeeze glutes forcefully for two seconds at the top before lowering under control."
        ),
        "alternative_exercise_slugs": "superman_hold,single_leg_romanian_deadlift_bodyweight",
    },
    {
        "slug": "single_leg_romanian_deadlift_bodyweight",
        "name": "Single-Leg Romanian Deadlift (Bodyweight)",
        "movement_category": "hinge",
        "primary_muscle": "hamstrings",
        "secondary_muscles": "glutes,lower_back",
        "equipment_required": "bodyweight",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Stand tall balancing on one foot with a slight, soft bend in the standing knee.\n"
            "2. Hinge at hips to push pelvis backward while allowing your free leg to extend straight behind you.\n"
            "3. Lower torso until parallel to floor or a deep hamstring stretch is reached.\n"
            "4. Drive through standing heel and contract glutes to return to standing."
        ),
        "alternative_exercise_slugs": "bodyweight_glute_bridge,superman_hold",
    },
    {
        "slug": "superman_hold",
        "name": "Superman Back Extension",
        "movement_category": "hinge",
        "primary_muscle": "lower_back",
        "secondary_muscles": "glutes,upper_back",
        "equipment_required": "bodyweight",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Lie prone (face down) on a mat with arms extended forward and legs straight.\n"
            "2. Contract your posterior chain to raise arms, chest, and thighs several inches off the floor simultaneously.\n"
            "3. Hold the contracted position for 2 to 3 seconds before slowly relaxing down."
        ),
        "alternative_exercise_slugs": "bodyweight_glute_bridge,plank",
    },
    {
        "slug": "bodyweight_walking_lunge",
        "name": "Bodyweight Walking Lunge",
        "movement_category": "lunge",
        "primary_muscle": "quadriceps",
        "secondary_muscles": "glutes,hamstrings,calves",
        "equipment_required": "bodyweight",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Stand upright with feet hip-width apart and hands placed on hips.\n"
            "2. Step forward with one leg and sink hips down until both knees reach 90-degree angles.\n"
            "3. Push off the front heel to step directly forward into the next lunge on the opposing leg."
        ),
        "alternative_exercise_slugs": "bulgarian_split_squat_bodyweight,bodyweight_air_squat",
    },
    {
        "slug": "bulgarian_split_squat_bodyweight",
        "name": "Bodyweight Bulgarian Split Squat",
        "movement_category": "lunge",
        "primary_muscle": "quadriceps",
        "secondary_muscles": "glutes,hamstrings",
        "equipment_required": "bodyweight",
        "difficulty_level": "intermediate",
        "instructions": (
            "1. Stand roughly two feet ahead of a stable bench or chair, resting top of rear foot on the elevation.\n"
            "2. Lower front thigh until parallel to the floor, maintaining an upright torso.\n"
            "3. Drive through front heel to return to top extension without locking knee."
        ),
        "alternative_exercise_slugs": "bodyweight_walking_lunge,bodyweight_air_squat",
    },
    {
        "slug": "bodyweight_standing_calf_raise",
        "name": "Bodyweight Standing Calf Raise",
        "movement_category": "isolation",
        "primary_muscle": "calves",
        "secondary_muscles": "feet",
        "equipment_required": "bodyweight",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Stand tall near a wall or railing for light balance assistance.\n"
            "2. Rise onto the balls of both feet as high as possible, contracting calves at the peak.\n"
            "3. Lower slowly until heels touch the ground and repeat with steady tempo."
        ),
        "alternative_exercise_slugs": "bodyweight_air_squat",
    },
    {
        "slug": "doorframe_row_bodyweight",
        "name": "Bodyweight Doorframe Row",
        "movement_category": "horizontal_pull",
        "primary_muscle": "lats",
        "secondary_muscles": "biceps,upper_back",
        "equipment_required": "bodyweight",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Stand facing a sturdy doorframe or vertical pillar, gripping it with hands at mid-chest level.\n"
            "2. Place feet close to base of frame and lean back until arms are fully extended.\n"
            "3. Pull chest firmly into the frame by driving elbows back and retracting shoulder blades."
        ),
        "alternative_exercise_slugs": "inverted_row",
    },
    {
        "slug": "side_plank",
        "name": "Side Plank",
        "movement_category": "core",
        "primary_muscle": "abdominals",
        "secondary_muscles": "obliques,glutes,shoulders",
        "equipment_required": "bodyweight",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Lie on your side with elbow directly beneath shoulder and feet stacked.\n"
            "2. Raise hips off the floor until your body aligns in a straight rigid plank from head to feet.\n"
            "3. Hold steadily without letting hips sag toward the mat."
        ),
        "alternative_exercise_slugs": "plank,mountain_climbers",
    },
    {
        "slug": "mountain_climbers",
        "name": "Mountain Climbers",
        "movement_category": "core",
        "primary_muscle": "abdominals",
        "secondary_muscles": "shoulders,hip_flexors",
        "equipment_required": "bodyweight",
        "difficulty_level": "beginner",
        "instructions": (
            "1. Assume a push-up position with hands beneath shoulders and hips level with spine.\n"
            "2. Drive one knee rapidly toward your chest while keeping core tight.\n"
            "3. Alternate legs dynamically in a continuous, controlled running cadence."
        ),
        "alternative_exercise_slugs": "plank,side_plank",
    },
]

