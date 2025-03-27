import { CourseModule as CourseModuleType } from "@/app/types/course";

const CourseModule = ({ module }: { module: CourseModuleType }) => {
  return (
    <div className="border rounded-lg p-4 mb-4">
      <h3 className="text-xl font-semibold">{module.title}</h3>
      <p className="text-gray-600 mt-1">{module.description}</p>
      {module.topics && module.topics.length > 0 && (
        <div className="mt-4">
          <h4 className="text-lg font-medium mb-2">Topics</h4>
          <ul className="list-disc pl-5">
            {module.topics.map((topic) => (
              <li key={topic.id} className="mt-1">
                {topic.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CourseModule; 