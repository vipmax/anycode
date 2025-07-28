import React, { useEffect, useRef } from 'react';
import { AnycodeEditor } from 'anycode-base';

interface AnycodeEditorProps {
    id: string;
    text: string;
}

export default function AnycodeEditorReact({ id, text }: AnycodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<AnycodeEditor | null>(null);

  useEffect(() => {
    const editor = new AnycodeEditor(text);
    editorRef.current = editor;

    const setup = async () => {
      await editor.init();
      editor.render();

      if (containerRef.current) {
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(editor.getContainer());
      }
    };

    setup();

    return () => {
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
    };
  }, [id]);

  useEffect(() => {
    editorRef.current?.setText?.(text);
    editorRef.current?.render();

    if (containerRef.current && editorRef.current) {
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(editorRef.current.getContainer());
    }
  }, [text]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
