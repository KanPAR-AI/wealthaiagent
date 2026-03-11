import { useCallback } from "react"

interface SpecialistOption {
  id: string
  name: string
  description: string
  icon: string
  color: string
}

const SPECIALISTS: SpecialistOption[] = [
  {
    id: "medical_nutrition",
    name: "Medical Nutrition",
    description: "Diabetes, PCOS, thyroid, kidney, heart conditions",
    icon: "🏥",
    color: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 hover:border-red-400",
  },
  {
    id: "pregnancy_nutrition",
    name: "Pregnancy Nutrition",
    description: "Trimester-specific plans, prenatal vitamins, GDM",
    icon: "🤰",
    color: "bg-pink-50 dark:bg-pink-950 border-pink-200 dark:border-pink-800 hover:border-pink-400",
  },
  {
    id: "kids_nutrition",
    name: "Kids Nutrition",
    description: "Age-appropriate meals, school lunch, picky eaters",
    icon: "👶",
    color: "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 hover:border-yellow-400",
  },
  {
    id: "sports_nutrition",
    name: "Sports Nutrition",
    description: "Training phases, meal timing, carb loading",
    icon: "🏃",
    color: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 hover:border-green-400",
  },
  {
    id: "fitness_nutrition",
    name: "Fitness Nutrition",
    description: "Cutting, bulking, body recomp, macro tracking",
    icon: "💪",
    color: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 hover:border-blue-400",
  },
  {
    id: "general_nutrition",
    name: "General Nutrition",
    description: "Balanced diet, meal plans, healthy eating advice",
    icon: "🥗",
    color: "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400",
  },
]

interface SpecialistPickerWidgetProps {
  id: string
  type: string
  title?: string
  description?: string
  data: any
  isHistory?: boolean
}

export function SpecialistPickerWidget({
  title,
  description,
  data,
  isHistory,
}: SpecialistPickerWidgetProps) {
  const handleSelect = useCallback((specialist: SpecialistOption) => {
    if (isHistory) return

    const message = `I'd like to work with the ${specialist.name} specialist. ${specialist.id === "general_nutrition" ? "Help me with a general diet plan." : ""}`

    window.dispatchEvent(
      new CustomEvent('chat-quick-reply', { detail: { text: message } })
    )
  }, [isHistory])

  return (
    <div className="w-full max-w-2xl mx-auto">
      {title && (
        <h3 className="text-lg font-semibold mb-1 text-foreground">
          {title}
        </h3>
      )}
      {description && (
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SPECIALISTS.map((specialist) => (
          <button
            key={specialist.id}
            onClick={() => handleSelect(specialist)}
            disabled={isHistory}
            className={`
              flex flex-col items-start p-4 rounded-xl border-2 transition-all
              ${specialist.color}
              ${isHistory ? "opacity-60 cursor-default" : "cursor-pointer hover:shadow-md active:scale-[0.98]"}
            `}
          >
            <span className="text-2xl mb-2">{specialist.icon}</span>
            <span className="font-medium text-sm text-foreground">
              {specialist.name}
            </span>
            <span className="text-xs text-muted-foreground mt-1 text-left leading-relaxed">
              {specialist.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
