imap jk <Esc>

" Move to the beginning and end of line
nmap H ^
nmap L $

" yank to system clipboard
set clipboard=unnamed

" Split windows
nmap <C-w>h :obcommand<space>workspace:split-horizontal<CR>
nmap <C-w>v :obcommand<space>workspace:split-vertical<CR>
