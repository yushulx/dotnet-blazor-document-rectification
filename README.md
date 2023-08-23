# .NET Blazor Document Rectification
This project is a .NET Blazor WebAssembly application designed to rectify documents from both image files and camera streams, utilizing the [Dynamsoft Document Normalizer SDK](https://www.npmjs.com/package/dynamsoft-label-recognizer).

## Getting Started
1. Request a [free trial license](https://www.dynamsoft.com/customer/license/trialLicense?product=ddn&utm_source=github&utm_campaign=dotnet-blazor-document-rectification&package=js) of Dynamsoft Document Normalizer.
2. Update the license key in `Index.razor`:
    
    ```csharp
    initialized = await JSRuntime.InvokeAsync<Boolean>("jsFunctions.initSDK", "LICENSE-KEY");
    ``````
3. Run the app:

    ```
    dotnet watch run
    ```

