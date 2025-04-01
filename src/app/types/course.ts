// Create a new file for shared types
export interface ModuleTopic {
  id: string;
  title: string;
  content?: string;
  // Additional optional properties for backward compatibility
  videoId?: string;
  notes?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface CourseModule {
  id: number;
  title: string;
  description: string;
  progress: number;
  topics?: ModuleTopic[];
  // Optional fields for backward compatibility
  content?: string;
  videoId?: string;
  quiz?: QuizQuestion[];
  // Add completedTopics for progress tracking
  completedTopics?: number[];
}

export interface Course {
  // Add id property
  id?: string;
  title: string;
  progress: number;
  content: CourseModule[];
  modules?: number;
} 