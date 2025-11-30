import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { io } from "socket.io-client";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const LANGUAGE_TEMPLATES = {
  python: `# Python Code
print("Hello, World!")
for i in range(5):
    print(f"Number: {i}")`,
  javascript: `// JavaScript Code
console.log("Hello, World!");
for (let i = 0; i < 5; i++) {
    console.log(\`Number: \${i}\`);
}`,
  cpp: `// C++ Code
#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    for (int i = 0; i < 5; i++) {
        cout << "Number: " << i << endl;
    }
    return 0;
}`,
  java: `// Java Code
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
        for (int i = 0; i < 5; i++) {
            System.out.println("Number: " + i);
        }
    }
}`,
};

const MONACO_LANGUAGES = {
  python: "python",
  javascript: "javascript",
  cpp: "cpp",
  java: "java",
};

const LANGUAGE_INFO = {
  python: { name: "Python", color: "bg-blue-500" },
  javascript: { name: "JavaScript", color: "bg-yellow-500" },
  cpp: { name: "C++", color: "bg-purple-500" },
  java: { name: "Java", color: "bg-red-500" },
};

function App() {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(LANGUAGE_TEMPLATES.python);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [executionTime, setExecutionTime] = useState(null);
  const [memoryUsage, setMemoryUsage] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState("");
  const socketRef = useRef(null);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowLanguageDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    socketRef.current = io(API_URL);

    socketRef.current.on("connect", () => {
      // WebSocket connected
    });

    socketRef.current.on("disconnect", () => {
      // WebSocket disconnected
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (!jobId || !socketRef.current) return;

    socketRef.current.emit("subscribe", jobId);

    socketRef.current.on("jobCompleted", (data) => {
      if (data.jobId === jobId) {
        handleJobResult(data.result);
      }
    });

    socketRef.current.on("jobFailed", (data) => {
      if (data.jobId === jobId) {
        setError(data.error);
        setIsRunning(false);
        setStatus("failed");
      }
    });

    socketRef.current.on("jobProgress", (data) => {
      if (data.jobId === jobId) {
        setStatus(`Processing... ${data.progress}%`);
      }
    });

    return () => {
      socketRef.current.off("jobCompleted");
      socketRef.current.off("jobFailed");
      socketRef.current.off("jobProgress");
    };
  }, [jobId]);

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    setCode(LANGUAGE_TEMPLATES[newLanguage]);
    setOutput("");
    setError("");
    setExecutionTime(null);
    setMemoryUsage(null);
    setShowLanguageDropdown(false);
  };

  const handleJobResult = (result) => {
    setOutput(result.output);
    setError(result.error);
    setExecutionTime(result.executionTime);
    setMemoryUsage(result.memoryUsage);
    setIsRunning(false);
    setStatus("completed");
  };

  const pollJobStatus = async (jobId) => {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/status/${jobId}`);
        const data = response.data;

        if (data.status === "completed") {
          handleJobResult(data.result);
        } else if (data.status === "failed") {
          setError(data.error);
          setIsRunning(false);
          setStatus("failed");
        } else {
          attempts++;
          if (attempts < maxAttempts) {
            setStatus(`${data.status}... ${data.progress || 0}%`);
            setTimeout(poll, 1000);
          } else {
            setError("Timeout: Job took too long");
            setIsRunning(false);
            setStatus("timeout");
          }
        }
      } catch (err) {
        setError(err.message);
        setIsRunning(false);
        setStatus("error");
      }
    };

    poll();
  };

  const handleRun = async () => {
    setIsRunning(true);
    setOutput("");
    setError("");
    setExecutionTime(null);
    setMemoryUsage(null);
    setStatus("submitting...");

    try {
      const response = await axios.post(`${API_URL}/api/execute`, {
        code,
        language,
      });

      const data = response.data;

      if (data.success) {
        setJobId(data.jobId);
        setStatus("queued");
        pollJobStatus(data.jobId);
      } else {
        setError(data.error);
        setIsRunning(false);
        setStatus("error");
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setIsRunning(false);
      setStatus("error");
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDarkMode
          ? "bg-linear-to-br from-gray-900 via-gray-900 to-gray-800 text-white"
          : "bg-linear-to-br from-gray-50 via-blue-50 to-indigo-50 text-gray-900"
      }`}
    >
      {/* Header */}
      <header
        className={`backdrop-blur-sm border-b px-6 py-4 shadow-lg transition-colors duration-300 ${
          isDarkMode
            ? "bg-gray-800/50 border-gray-700"
            : "bg-white/70 border-gray-200"
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1
              className={`text-2xl font-bold bg-amber-300 bg-clip-text text-transparent`}
            >
              Code Execution Platform
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`px-4 py-2 rounded-lg transition-all font-medium flex items-center gap-2 shadow-md ${
                isDarkMode
                  ? "bg-gray-700 hover:bg-gray-600 text-white"
                  : "bg-white hover:bg-gray-50 text-gray-900 border border-gray-200"
              }`}
            >
              <span>{isDarkMode ? "Light" : "Dark"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Code Editor Panel */}
          <div
            className={`backdrop-blur rounded-xl overflow-hidden shadow-2xl border transition-colors duration-300 ${
              isDarkMode
                ? "bg-gray-800/90 border-gray-700/50"
                : "bg-white/90 border-gray-200"
            }`}
          >
            {/* Editor Toolbar */}
            <div
              className={`px-4 py-3 flex items-center justify-between border-b transition-colors duration-300 ${
                isDarkMode
                  ? "bg-gray-700/90 border-gray-600/50"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              {/* Language Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 shadow-md ${
                    isDarkMode
                      ? "bg-gray-600 hover:bg-gray-500 text-white"
                      : "bg-white hover:bg-gray-50 text-gray-900 border border-gray-300"
                  }`}
                >
                  <span className="text-lg">
                    {LANGUAGE_INFO[language].icon}
                  </span>
                  <span>{LANGUAGE_INFO[language].name}</span>
                  <span
                    className={`transition-transform ${
                      showLanguageDropdown ? "rotate-180" : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>

                {showLanguageDropdown && (
                  <div
                    className={`absolute top-full left-0 mt-2 rounded-lg shadow-2xl overflow-hidden z-50 min-w-[200px] ${
                      isDarkMode
                        ? "bg-gray-700 border border-gray-600"
                        : "bg-white border border-gray-200"
                    }`}
                  >
                    {Object.keys(LANGUAGE_TEMPLATES).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => handleLanguageChange(lang)}
                        className={`w-full px-4 py-3 text-left transition-all flex items-center gap-3 ${
                          language === lang
                            ? isDarkMode
                              ? "bg-blue-600 text-white"
                              : "bg-blue-500 text-white"
                            : isDarkMode
                            ? "hover:bg-gray-600 text-gray-200"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <span className="text-xl">
                          {LANGUAGE_INFO[lang].icon}
                        </span>
                        <span className="font-medium">
                          {LANGUAGE_INFO[lang].name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Run Button */}
              <button
                onClick={handleRun}
                disabled={isRunning}
                className={`px-6 py-2 rounded-lg font-semibold transition-all shadow-lg flex items-center gap-2 ${
                  isRunning
                    ? isDarkMode
                      ? "bg-gray-600 cursor-not-allowed text-gray-400"
                      : "bg-gray-300 cursor-not-allowed text-gray-500"
                    : "bg-green-600 hover:bg-green-800 cursor-pointer active:scale-95 text-white"
                }`}
              >
                <span>{isRunning ? "Running..." : "Run Code"}</span>
              </button>
            </div>

            {/* Monaco Editor */}
            <Editor
              height="500px"
              language={MONACO_LANGUAGES[language]}
              value={code}
              onChange={(value) => setCode(value || "")}
              theme={isDarkMode ? "vs-dark" : "light"}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                fontFamily: "'Fira Code', 'Consolas', 'Courier New', monospace",
                fontLigatures: true,
              }}
            />
          </div>

          {/* Output Panel */}
          <div
            className={`backdrop-blur rounded-xl shadow-2xl overflow-hidden flex flex-col border transition-colors duration-300 ${
              isDarkMode
                ? "bg-gray-800/90 border-gray-700/50"
                : "bg-white/90 border-gray-200"
            }`}
          >
            {/* Output Header */}
            <div
              className={`px-4 py-3 border-b flex items-center justify-between transition-colors duration-300 ${
                isDarkMode
                  ? "bg-gray-700/90 border-gray-600/50"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-lg">Output</h2>
              </div>
              {status && (
                <span
                  className={`text-sm px-3 py-1 rounded-full ${
                    isDarkMode
                      ? "bg-gray-600 text-gray-300"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {status}
                </span>
              )}
            </div>

            {/* Output Content */}
            <div className="flex-1 p-4 overflow-auto">
              {/* Execution Metrics */}
              {(executionTime !== null || memoryUsage !== null) && (
                <div
                  className={`mb-4 p-3 rounded-lg flex gap-4 text-sm transition-colors duration-300 ${
                    isDarkMode ? "bg-gray-700" : "bg-gray-100"
                  }`}
                >
                  {executionTime !== null && (
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          isDarkMode ? "text-gray-400" : "text-gray-600"
                        }
                      >
                        Execution Time:
                      </span>
                      <span
                        className={`font-mono font-semibold ${
                          isDarkMode ? "text-green-400" : "text-green-600"
                        }`}
                      >
                        {executionTime}ms
                      </span>
                    </div>
                  )}
                  {memoryUsage !== null && (
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          isDarkMode ? "text-gray-400" : "text-gray-600"
                        }
                      >
                        Memory:
                      </span>
                      <span
                        className={`font-mono font-semibold ${
                          isDarkMode ? "text-blue-400" : "text-blue-600"
                        }`}
                      >
                        {(memoryUsage / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Output Display */}
              {output && (
                <div className="mb-4">
                  <h3
                    className={`font-semibold mb-2 text-sm uppercase tracking-wide flex items-center gap-2 ${
                      isDarkMode ? "text-green-400" : "text-green-600"
                    }`}
                  >
                    <span>Output</span>
                  </h3>
                  <pre
                    className={`p-4 rounded-lg font-mono text-sm whitespace-pre-wrap border transition-colors duration-300 ${
                      isDarkMode
                        ? "bg-gray-900 border-green-900/50 text-gray-100"
                        : "bg-gray-50 border-green-200 text-gray-800"
                    }`}
                  >
                    {output}
                  </pre>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div>
                  <h3
                    className={`font-semibold mb-2 text-sm uppercase tracking-wide flex items-center gap-2 ${
                      isDarkMode ? "text-red-400" : "text-red-600"
                    }`}
                  >
                    <span>Error</span>
                  </h3>
                  <pre
                    className={`p-4 rounded-lg font-mono text-sm whitespace-pre-wrap border transition-colors duration-300 ${
                      isDarkMode
                        ? "bg-gray-900 border-red-900/50 text-red-300"
                        : "bg-red-50 border-red-200 text-red-700"
                    }`}
                  >
                    {error}
                  </pre>
                </div>
              )}

              {/* Empty State */}
              {!output && !error && !isRunning && (
                <div
                  className={`flex flex-col items-center justify-center h-full ${
                    isDarkMode ? "text-gray-500" : "text-gray-400"
                  }`}
                >
                  <div className="text-6xl mb-4">🚀</div>
                  <p className="text-lg font-medium">Ready to run your code</p>
                  <p className="text-sm mt-2">
                    Click the Run button to see output here
                  </p>
                </div>
              )}

              {/* Loading State */}
              {isRunning && !output && !error && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div
                      className={`animate-spin rounded-full h-16 w-16 border-4 border-t-transparent mx-auto mb-4 ${
                        isDarkMode ? "border-blue-500" : "border-blue-600"
                      }`}
                    ></div>
                    <p
                      className={`text-lg font-medium ${
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      {status || "Processing..."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div
          className={`mt-6 text-center text-sm transition-colors duration-300 ${
            isDarkMode ? "text-gray-500" : "text-gray-600"
          }`}
        >
          <p>Made with ❤️ by RKS</p>
        </div>
      </div>
    </div>
  );
}

export default App;
