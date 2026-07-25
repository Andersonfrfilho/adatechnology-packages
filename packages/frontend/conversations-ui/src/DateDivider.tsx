
export interface DateDividerProps {
  date: string
}

export const DateDivider = ({ date }: DateDividerProps) => {
  return (
    <div className="flex items-center justify-center my-4">
      <div className="bg-gray-200 rounded-full px-4 py-1">
        <span className="text-xs text-gray-500 font-medium">{date}</span>
      </div>
    </div>
  )
}
