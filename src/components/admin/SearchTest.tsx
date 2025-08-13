import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SearchResult {
  id: number;
  content: string;
  metadata: any;
  article_no: string | null;
  similarity?: number;
  score?: number;
}

export const SearchTest = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState<'semantic' | 'hybrid'>('hybrid');
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a search query',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      if (searchType === 'semantic') {
        // First generate embedding for the query
        const { data: embeddingData, error: embeddingError } = await supabase.functions.invoke('generate-embedding', {
          body: { text: query }
        });

        if (embeddingError) throw embeddingError;

        // Then search using the embedding
        const { data, error } = await supabase.rpc('match_documents', {
          query_embedding: embeddingData.embedding,
          match_count: 10
        });

        if (error) throw error;
        setResults(data || []);
      } else {
        // Hybrid search - also needs embedding
        const { data: embeddingData, error: embeddingError } = await supabase.functions.invoke('generate-embedding', {
          body: { text: query }
        });

        if (embeddingError) throw embeddingError;

        const { data, error } = await supabase.rpc('match_hybrid', {
          query_text: query,
          query_embedding: embeddingData.embedding,
          match_count: 10
        });

        if (error) throw error;
        setResults(data || []);
      }

      toast({
        title: 'Search Complete',
        description: `Found ${results.length} results`
      });
    } catch (error: any) {
      console.error('Search error:', error);
      toast({
        title: 'Search Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test Knowledge Base Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="search-query">Search Query</Label>
            <Input
              id="search-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your search query..."
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant={searchType === 'semantic' ? 'default' : 'outline'}
              onClick={() => setSearchType('semantic')}
              size="sm"
            >
              Semantic Search
            </Button>
            <Button
              variant={searchType === 'hybrid' ? 'default' : 'outline'}
              onClick={() => setSearchType('hybrid')}
              size="sm"
            >
              Hybrid Search
            </Button>
          </div>
          
          <Button onClick={handleSearch} disabled={loading} className="w-full">
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Search Results ({results.length})</h3>
          {results.map((result, index) => (
            <Card key={result.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex gap-2 items-center">
                    <Badge variant="secondary">#{index + 1}</Badge>
                    {result.article_no && (
                      <Badge variant="outline">{result.article_no}</Badge>
                    )}
                  </div>
                  <Badge variant="default">
                    {searchType === 'semantic' 
                      ? `${(result.similarity! * 100).toFixed(1)}% similarity`
                      : `Score: ${result.score!.toFixed(3)}`
                    }
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Chunk ID: {result.id} | File: {result.metadata?.file_id || 'Unknown'}
                </p>
                <p className="text-sm leading-relaxed">{result.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};