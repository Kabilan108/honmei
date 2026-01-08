import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function HomePage() {
  const library = useQuery((api as any).library?.getByElo);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Library</h1>
        <p className="text-neutral-400 mt-2">
          Your anime and manga collection, ranked by preference
        </p>
      </div>

      {library === undefined ? (
        <div className="text-neutral-400">Loading...</div>
      ) : library.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral-400 mb-4">Your library is empty</p>
          <p className="text-sm text-neutral-500">
            Add some anime or manga from the Search tab to get started!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {library.map((item: any) => (
            <div
              key={item._id}
              className="bg-neutral-900 rounded-lg overflow-hidden border border-neutral-800"
            >
              <div className="aspect-[2/3] bg-neutral-800">
                {item.media?.coverImage && (
                  <img
                    src={item.media.coverImage}
                    alt={item.media.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="p-3">
                <h3 className="font-medium text-sm line-clamp-2 mb-2">
                  {item.media?.title}
                </h3>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-blue-400 font-mono">
                    {item.eloRating}
                  </span>
                  <span className="text-neutral-500">
                    {item.comparisonCount} compares
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
