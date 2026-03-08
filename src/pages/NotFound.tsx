import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-dot-pattern px-4">
      <div className="text-center space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-primary/60" />
          </div>
          <h1 className="text-5xl font-bold text-foreground tracking-tight">404</h1>
          <p className="text-lg text-muted-foreground">Page not found</p>
        </div>
        <Link to="/">
          <Button variant="outline" className="rounded-full">
            Return to Home
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
