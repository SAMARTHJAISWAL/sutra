-module(sutra_ffi).
-export([halt/1]).

%% Flush output before stopping the VM, so piped stdout is complete.
halt(Code) ->
    _ = io:put_chars(""),
    erlang:halt(Code, [{flush, true}]).
