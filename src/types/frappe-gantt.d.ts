declare module 'frappe-gantt' {
  export interface GanttTask {
    id: string
    name: string
    start: string
    end: string
    progress: number
    dependencies?: string
    custom_class?: string
    description?: string
  }

  export interface GanttOptions {
    view_mode?: string
    readonly?: boolean
    readonly_progress?: boolean
    today_button?: boolean
    scroll_to?: string
    on_date_change?: (task: GanttTask, start: Date, end: Date) => void
    on_progress_change?: (task: GanttTask, progress: number) => void
    [key: string]: unknown
  }

  export default class Gantt {
    constructor(wrapper: HTMLElement | string, tasks: GanttTask[], options?: GanttOptions)
    refresh(tasks: GanttTask[]): void
    change_view_mode(mode?: string, maintainPos?: boolean): void
  }
}

declare module '*.css'
