interface DashboardMinimalHeaderProps {
  title: string;
  description?: string | null;
}

/** Landing-page header: title and the first two lines of the description. */
export function DashboardMinimalHeader({ title, description }: DashboardMinimalHeaderProps) {
  return (
    <div className="bg-white border-b flex-shrink-0 px-6 py-6">
      <div>
        <h1 className="text-3xl font-bold truncate">{title}</h1>
        {description && (
          <p className="text-base text-gray-600 mt-2 line-clamp-2 max-w-3xl">{description}</p>
        )}
      </div>
    </div>
  );
}
