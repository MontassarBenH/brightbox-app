# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - link "← Back" [ref=e4] [cursor=pointer]:
      - /url: /
    - heading "Welcome Back" [level=2] [ref=e5]
    - generic [ref=e6]:
      - generic [ref=e7]:
        - generic [ref=e8]: Email
        - textbox "your@email.com" [ref=e9]
      - generic [ref=e10]:
        - generic [ref=e11]: Password
        - textbox "••••••••" [ref=e12]
      - button "Sign In" [ref=e13]
    - paragraph [ref=e14]:
      - text: Don't have an account?
      - link "Sign up" [ref=e15] [cursor=pointer]:
        - /url: /signup
  - alert [ref=e16]
```